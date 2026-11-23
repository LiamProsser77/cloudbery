async function createAccount(event) {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    if (username.length < 3) {
        alert("Username must be at least 3 characters.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
    });

    if (error) {
        alert(error.message);
        return;
    }

    if (!data.user) {
        alert("Account could not be created.");
        return;
    }

    const { error: profileError } = await supabaseClient
        .from("profiles")
        .insert({
            id: data.user.id,
            username,
            email,
            picture: "cloudbery-logo.png",
            banner: "",
            followers: 0
        });

    if (profileError) {
        alert("Your account was created, but your profile could not be saved: " + profileError.message);
        return;
    }

    if (!data.session) {
        alert("Account created! Check your email to confirm your address, then sign in.");
        window.location.href = "signin.html";
        return;
    }

    window.location.href = "feed.html";
}

async function signIn(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert(error.message);
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
        alert("Your account was found, but your profile could not be loaded.");
        return;
    }

    window.location.href = "interests.html";
}

async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
        console.error(error);
        return null;
    }

    return data.user;
}

async function loadProfile() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get("user");

    const cornerName = document.getElementById("cornerName");

    if (!username) {
        if (cornerName) cornerName.textContent = "No profile selected";
        return;
    }

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

    if (error || !data) {
        console.error(error);
        if (cornerName) cornerName.textContent = "Profile not found";
        return;
    }

    if (cornerName) cornerName.textContent = data.username;

    const followers = document.getElementById("followers");
    const profilePic = document.getElementById("profilePic");
    const banner = document.getElementById("banner");

    if (followers) {
        followers.textContent = (data.followers || 0) + " Followers";
    }

    if (profilePic) {
        profilePic.src = data.picture || "cloudbery-logo.png";
    }

    if (banner && data.banner) {
        banner.style.backgroundImage = `url('${data.banner}')`;
    }
}

async function uploadProfile(event) {
    const file = event.target.files[0];

    if (!file) return;

    const user = await getCurrentUser();

    if (!user) {
        alert("Please sign in first.");
        return;
    }

    const filePath = user.id + "/profile.png";

    const { error } = await supabaseClient
        .storage
        .from("profiles")
        .upload(filePath, file, { upsert: true });

    if (error) {
        alert(error.message);
        return;
    }

    const { data } = supabaseClient
        .storage
        .from("profiles")
        .getPublicUrl(filePath);

    const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ picture: data.publicUrl })
        .eq("id", user.id);

    if (updateError) {
        alert(updateError.message);
        return;
    }

    alert("Profile picture saved!");
    location.reload();
}

async function uploadBanner(event) {
    const file = event.target.files[0];

    if (!file) return;

    const user = await getCurrentUser();

    if (!user) {
        alert("Please sign in first.");
        return;
    }

    const filePath = user.id + "/banner.png";

    const { error } = await supabaseClient
        .storage
        .from("profiles")
        .upload(filePath, file, { upsert: true });

    if (error) {
        alert(error.message);
        return;
    }

    const { data } = supabaseClient
        .storage
        .from("profiles")
        .getPublicUrl(filePath);

    const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ banner: data.publicUrl })
        .eq("id", user.id);

    if (updateError) {
        alert(updateError.message);
        return;
    }

    alert("Banner saved!");
    location.reload();
}

async function saveProfile() {
    const user = await getCurrentUser();

    if (!user) {
        alert("Please sign in first.");
        return;
    }

    const username = document.getElementById("nameInput").value.trim();

    if (!username) {
        alert("Please enter a username.");
        return;
    }

    const { error } = await supabaseClient
        .from("profiles")
        .update({ username })
        .eq("id", user.id);

    if (error) {
        alert(error.message);
        return;
    }

    alert("Profile updated!");
    window.location.href = "profile.html?user=" + encodeURIComponent(username);
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert(error.message);
        return;
    }

    window.location.href = "signin.html";
}

window.addEventListener("load", function() {
    if (document.getElementById("cornerName")) {
        loadProfile();
    }
});
