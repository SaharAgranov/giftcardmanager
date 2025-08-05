document.addEventListener("DOMContentLoaded", () => {
    // -------------------------
    // DELETE Card (Personal or Group)
    // -------------------------
    const deleteButtons = document.querySelectorAll(".delete-btn");

    deleteButtons.forEach(button => {
        button.addEventListener("click", () => {
            const cardId = button.getAttribute("data-id");
            const cardTarget = button.getAttribute("data-target");

            if (!confirm("Delete this card?")) return;

            fetch(`/delete_card/${cardTarget}/${cardId}`, {
                method: "DELETE"
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    button.closest(".list-group-item").remove();
                } else {
                    alert("Failed to delete card.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("Error deleting card.");
            });
        });
    });

    // -------------------------
    // EDIT Card (Personal or Group)
    // -------------------------
    const editButtons = document.querySelectorAll(".edit-btn");
    const editModalEl = document.getElementById("editModal");
    const editModal = new bootstrap.Modal(editModalEl);
    const saveEditBtn = document.getElementById("saveEditBtn");

    // Prefill modal when Edit clicked
    editButtons.forEach(button => {
        button.addEventListener("click", () => {
            document.getElementById("editCardId").value = button.getAttribute("data-id");
            document.getElementById("editCardTarget").value = button.getAttribute("data-target");
            document.getElementById("editStore").value = button.getAttribute("data-store") || "";
            document.getElementById("editNumber").value = button.getAttribute("data-number") || "";
            document.getElementById("editBalance").value = button.getAttribute("data-balance") || "";
            document.getElementById("editExpiry").value = button.getAttribute("data-expiry") || "";
            document.getElementById("editNotes").value = button.getAttribute("data-notes") || "";

            editModal.show();
        });
    });

    // Clear modal form when hidden (Cancel or X)
    editModalEl.addEventListener("hidden.bs.modal", () => {
        document.getElementById("editForm").reset();
    });

    // Save changes (AJAX PUT)
    saveEditBtn.addEventListener("click", () => {
        const cardId = document.getElementById("editCardId").value;
        const cardTarget = document.getElementById("editCardTarget").value;

        const data = {
            store: document.getElementById("editStore").value,
            number: document.getElementById("editNumber").value,
            balance: document.getElementById("editBalance").value,
            expiry: document.getElementById("editExpiry").value,
            notes: document.getElementById("editNotes").value
        };

        // Show loading state
        saveEditBtn.disabled = true;
        saveEditBtn.textContent = "Saving...";

        fetch(`/edit_card/${cardTarget}/${cardId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(updatedCard => {
            // Update card display (text + notes)
            const cardElement = document.querySelector(`.edit-btn[data-id="${cardId}"][data-target="${cardTarget}"]`).closest(".list-group-item");

            cardElement.firstElementChild.innerHTML = `
                <strong>${updatedCard.store || "Unnamed Card"}</strong> – ${updatedCard.balance || 0} ₪
                <small class="text-muted">(Expires: ${updatedCard.expiry || "N/A"})</small>
                ${updatedCard.notes ? `<div class="text-muted small">Notes: ${updatedCard.notes}</div>` : ""}
            `;

            // Update Edit button attributes
            const editButton = cardElement.querySelector(".edit-btn");
            editButton.setAttribute("data-store", updatedCard.store);
            editButton.setAttribute("data-number", updatedCard.number);
            editButton.setAttribute("data-balance", updatedCard.balance);
            editButton.setAttribute("data-expiry", updatedCard.expiry);
            editButton.setAttribute("data-notes", updatedCard.notes || "");

            editModal.hide();
        })
        .catch(err => {
            console.error(err);
            alert("Error updating card.");
        })
        .finally(() => {
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = "Save changes";
        });
    });


    



    // -------------------------
// CARD LIST FILTER + STORE SUGGESTIONS
// -------------------------
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

if (searchInput) {
    function applyCardFilter(term) {
        const filter = term.toLowerCase();
        document.querySelectorAll("#cardsContainer .list-group-item").forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(filter) ? "" : "none";
        });
    }

    function fuzzyMatch(term, target) {
        return target && target.toLowerCase().includes(term.toLowerCase());
    }

    searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim();
        applyCardFilter(term); // still filter while typing

        searchResults.innerHTML = "";
        if (!term) {
            searchResults.style.display = "none";
            return;
        }

        const results = storesData.filter(store =>
            fuzzyMatch(term, store.name_he || "") ||
            fuzzyMatch(term, store.name_en || "")
        );

        if (results.length) {
            const cardItems = Array.from(document.querySelectorAll("#cardsContainer .list-group-item"));
            const uniqueResults = [];
            const seen = new Set();

            results.forEach(store => {
                const storeName = (store.name_he || store.name_en || "").trim();
                const brandName = (store.brand || "").trim();
                const key = storeName.toLowerCase();  // Deduplicate by store name only

//                const key = `${brandName}-${storeName}`.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);

                const cardCount = cardItems.filter(item => {
                    const badge = item.querySelector(".badge")?.textContent.toLowerCase() || "";
                    return badge.includes(brandName.toLowerCase());
                }).length;

                const div = document.createElement("div");
                div.className = "list-group-item d-flex justify-content-between align-items-center";

                const nameSpan = document.createElement("span");
                nameSpan.textContent = storeName;

                const countBadge = document.createElement("span");
                countBadge.className = "badge bg-secondary rounded-pill";
                countBadge.textContent = `${cardCount} card${cardCount !== 1 ? "s" : ""}`;

                div.appendChild(nameSpan);
                div.appendChild(countBadge);

                // --- NEW: Show modal with matching cards ---
                div.addEventListener("click", () => {
                    searchInput.value = storeName;
                    searchResults.style.display = "none";

                    const brandLower = brandName.toLowerCase();
                    const matchingCards = cardItems.filter(item => {
                        const badge = item.querySelector(".badge")?.textContent.toLowerCase() || "";
                        return badge.includes(brandLower);
                    });

                    const modalTitle = document.getElementById("storeModalTitle");
                    const modalBody = document.getElementById("storeModalBody");

                    modalTitle.textContent = `Cards for ${storeName}`;
                    modalBody.innerHTML = "";

                    if (matchingCards.length > 0) {
                        matchingCards.forEach(card => {
                            const clone = card.cloneNode(true);
                            modalBody.appendChild(clone);
                        });
                    } else {
                        modalBody.innerHTML = `<p>No cards available for this store.</p>`;
                    }

                    const modal = new bootstrap.Modal(document.getElementById("storeModal"));
                    modal.show();
                });

                uniqueResults.push(div);
            });

            uniqueResults.forEach(div => searchResults.appendChild(div));
            searchResults.style.display = "block";
        } else {
            searchResults.style.display = "none";
        }
    });
}
});
