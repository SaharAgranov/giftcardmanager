const firebaseConfig = {
    apiKey: "AIzaSyAV0q85uLKk26_a6hXj5xJvhGFqLVL-Wew",               // from Firebase console Web App settings
    authDomain: "gift-card-manager-3548d.firebaseapp.com",
    projectId: "gift-card-manager-3548d",
};

firebase.initializeApp(firebaseConfig);

document.getElementById("googleSignInBtn").addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider)
        .then(result => result.user.getIdToken())
        .then(idToken => {
            return fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id_token: idToken })
            });
        })
        .then(() => {
            window.location.href = "/dashboard";
        })
        .catch(error => {
            alert("Login failed: " + error.message);
            console.error(error);
        });
});
