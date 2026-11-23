async function uploadVideo() {
    const titleInput = document.getElementById("videoTitle");
    const fileInput = document.getElementById("videoFile");
    const status = document.getElementById("uploadStatus");

    const title = titleInput.value.trim();
    const file = fileInput.files[0];

    if (!title || !file) {
        status.textContent = "Enter a title and choose a video.";
        return;
    }

    if (!file.type.startsWith("video/")) {
        status.textContent = "Please select a video file.";
        return;
    }

    status.textContent = "Uploading video...";

    const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

    if (userError || !userData.user) {
        status.textContent = "Please sign in before uploading.";
        return;
    }

    const user = userData.user;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = user.id + "/" + Date.now() + "-" + safeName;

    const { error: uploadError } = await supabaseClient
        .storage
        .from("videos")
        .upload(filePath, file);

    if (uploadError) {
        status.textContent = "Upload failed: " + uploadError.message;
        return;
    }

    const { error: databaseError } = await supabaseClient
        .from("videos")
        .insert({
            user_id: user.id,
            title: title,
            video_path: filePath
        });

    if (databaseError) {
        await supabaseClient.storage
            .from("videos")
            .remove([filePath]);

        status.textContent = "Could not save video: " + databaseError.message;
        return;
    }

    titleInput.value = "";
    fileInput.value = "";

    status.textContent = "Video uploaded successfully!";

    loadVideos();
}

async function loadVideos() {
    const feed = document.getElementById("videoFeed");

    if (!feed) return;

    feed.textContent = "Loading videos...";

    const search = document.getElementById("videoSearch")?.value.trim();
    const sort = document.getElementById("feedSort")?.value || "random";

    let query = supabaseClient
        .from("videos")
        .select("*");

    if (search) {
        query = query.ilike("title", "%" + search + "%");
    }

    query = query.order("created_at", { ascending: false }).limit(50);

    const { data: videos, error } = await query;

    if (error) {
        feed.textContent = "Could not load videos: " + error.message;
        return;
    }

    if (!videos || videos.length === 0) {
        feed.textContent = "No videos yet. Be the first to upload!";
        return;
    }

    if (sort === "random") {
        videos.sort(() => Math.random() - 0.5);
    }

    feed.replaceChildren();

    videos.forEach(video => {
        const { data } = supabaseClient
            .storage
            .from("videos")
            .getPublicUrl(video.video_path);

        const card = document.createElement("article");
        card.className = "video-card";

        const heading = document.createElement("h3");
        heading.textContent = video.title;

        const player = document.createElement("video");
        player.src = data.publicUrl;
        player.controls = true;
        player.playsInline = true;
        player.preload = "metadata";

        const date = document.createElement("p");
        date.textContent = new Date(video.created_at).toLocaleDateString();

        card.append(heading, player, date);
        feed.appendChild(card);
    });
}

function searchVideos() {
    loadVideos();
}

window.addEventListener("load", loadVideos);
