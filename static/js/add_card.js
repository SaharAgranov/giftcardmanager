document.addEventListener("DOMContentLoaded", () => {
    const brandSelect = document.getElementById("brandSelect");
    const storeList = document.getElementById("storeList");

    function loadStores(brand) {
        if (brand === "manual") {
            storeList.innerHTML = ""; // no autocomplete for manual
            return;
        }
        fetch(`/get_stores/${brand}`)
            .then(res => res.json())
            .then(stores => {
                storeList.innerHTML = "";
                stores.forEach(store => {
                    const option = document.createElement("option");
                    option.value = store.name_he || store.name_en;
                    storeList.appendChild(option);
                });
            })
            .catch(err => console.error("Error loading stores:", err));
    }

    loadStores(brandSelect.value);

    brandSelect.addEventListener("change", () => {
        loadStores(brandSelect.value);
    });
});
