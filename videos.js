let currentUser = null;
let videoObserver = null;


// GET CURRENT USER

async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
        console.error(error);
        currentUser = null;
        return null;
    }

    currentUser = data.user;
    return currentUser;
}


// UPLOAD VIDEO

async function uploadVideo(event) {
    if (event) event.preventDefault();

    const user = await getCurrentUser();

    if (!user) {
        alert("Please sign in before uploading videos.");
        window.location.href = "signin.html";
        return;
    }

    const titleInput = document.getElementById("videoTitle");
    const fileInput = document.getElementById("videoFile");
    const status = document.getElementById("uploadStatus");

    if (!titleInput || !fileInput) {
        alert("Upload form could not be found. Check the input IDs in upload.html.");
        return;
    }

    const title = titleInput.value.trim();
    const file = fileInput.files[0];

    if (!title) {
        alert("Please enter a video title.");
        return;
    }

    if (!file) {
        alert("Please select a video file.");
        return;
    }

    const allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert("Please upload an MP4, WebM, OGG, or MOV video.");
        return;
    }

    const maxSize = 100 * 1024 * 1024;

    if (file.size > maxSize) {
        alert("Your video must be smaller than 100 MB.");
        return;
    }

    const uploadButton = document.querySelector(
        'button[type="submit"]'
    );

    if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.textContent = "Uploading...";
    }

    if (status) {
        status.textContent = "Uploading your video...";
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const filePath = user.id + "/" + crypto.randomUUID() + "." + extension;

    try {
        // Upload file to Supabase Storage

        const { error: uploadError } = await supabaseClient
            .storage
            .from("videos")
            .upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            throw uploadError;
        }

        if (status) {
            status.textContent = "Saving video information...";
        }

        // Save video information to database

        const { error: databaseError } = await supabaseClient
            .from("videos")
            .insert({
                user_id: user.id,
                title: title,
                video_path: filePath
            });

        if (databaseError) {
            // Remove uploaded file if database save fails

            await supabaseClient
                .storage
                .from("videos")
                .remove([filePath]);

            throw databaseError;
        }

        alert("Your video was uploaded successfully!");

        window.location.href = "feed.html";

    } catch (error) {
        console.error("Video upload error:", error);

        if (status) {
            status.textContent = "Upload failed: " + error.message;
        }

        alert("Video upload failed: " + error.message);

        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.textContent = "Upload Video";
        }
    }
}


// LOAD VIDEOS

async function loadVideos() {
    const feed = document.getElementById("videoFeed");

    if (!feed) return;

    feed.innerHTML = '<div id="emptyFeed">Loading videos...</div>';

    await getCurrentUser();

    const { data: videos, error } = await supabaseClient
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        feed.textContent = "Could not load videos: " + error.message;
        return;
    }

    if (!videos || videos.length === 0) {
        feed.innerHTML = '<div id="emptyFeed">No videos yet. Be the first to upload!</div>';
        return;
    }

    // Load creator profiles

    const userIds = [...new Set(videos.map(video => video.user_id))];

    const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

    const profileMap = {};

    (profiles || []).forEach(profile => {
        profileMap[profile.id] = profile.username;
    });

    // Load likes

    const videoIds = videos.map(video => video.id);

    const { data: likes, error: likesError } = await supabaseClient
        .from("video_likes")
        .select("video_id, user_id")
        .in("video_id", videoIds);

    if (likesError) {
        feed.textContent = "Could not load likes: " + likesError.message;
        return;
    }

    const search = document
        .getElementById("videoSearch")
        ?.value.trim()
        .toLowerCase() || "";

    let results = videos.map(video => {
        const videoLikes = (likes || []).filter(
            like => like.video_id === video.id
        );

        return {
            ...video,
            creator: profileMap[video.user_id] || "Cloudbery user",
            likeCount: videoLikes.length,
            liked: currentUser
                ? videoLikes.some(like => like.user_id === currentUser.id)
                : false
        };
    });

    // Search titles and creators

    if (search) {
        results = results.filter(video =>
            video.title.toLowerCase().includes(search) ||
            video.creator.toLowerCase().includes(search)
        );
    }

    // Sorting

    const sort = document.getElementById("feedSort")?.value || "random";

    if (sort === "random") {
        results.sort(() => Math.random() - 0.5);
    }

    feed.replaceChildren();

    if (results.length === 0) {
        feed.innerHTML = '<div id="emptyFeed">No matching videos found.</div>';
        return;
    }

    if (videoObserver) {
        videoObserver.disconnect();
    }

    videoObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const player = entry.target;

            if (entry.isIntersecting) {
                player.play().catch(() => {});
            } else {
                player.pause();
            }
        });
    }, {
        threshold: 0.65
    });

    // Create video cards

    results.forEach(video => {
        const { data } = supabaseClient
            .storage
            .from("videos")
            .getPublicUrl(video.video_path);

        const card = document.createElement("article");
        card.className = "video-card";

        const player = document.createElement("video");
        player.src = data.publicUrl;
        player.playsInline = true;
        player.muted = true;
        player.loop = true;
        player.autoplay = true;
        player.preload = "metadata";

        const info = document.createElement("div");
        info.className = "video-info";

        const title = document.createElement("h3");
        title.textContent = video.title;

        const creator = document.createElement("p");
        creator.className = "creator";
        creator.textContent = "@" + video.creator;

        const actions = document.createElement("div");
        actions.className = "video-actions";

        const likeButton = document.createElement("button");
        likeButton.className = "like-button";
        likeButton.type = "button";
        likeButton.disabled = !currentUser;

        const logo = document.createElement("img");
        logo.src = "cloudbery-logo.png";
        logo.alt = "";
        logo.className = "like-logo";

        const count = document.createElement("span");
        count.className = "like-count";
        count.textContent = video.likeCount;

        likeButton.append(logo, count);

        if (video.liked) {
            likeButton.classList.add("liked");
        }

        likeButton.title = !currentUser
            ? "Sign in to like videos"
            : video.liked
                ? "Unlike video"
                : "Like video";

        likeButton.addEventListener("click", () => {
            toggleLike(video.id, likeButton);
        });

        actions.append(likeButton);

        info.append(title, creator, actions);
        card.append(player, info);
        feed.appendChild(card);

        videoObserver.observe(player);
    });
}


// LIKE AND UNLIKE VIDEOS

async function toggleLike(videoId, button) {
    if (!currentUser) {
        window.location.href = "signin.html";
        return;
    }

    button.disabled = true;

    const { data: existingLike, error: findError } = await supabaseClient
        .from("video_likes")
        .select("id")
        .eq("video_id", videoId)
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (findError) {
        alert("Could not check like: " + findError.message);
        button.disabled = false;
        return;
    }

    if (existingLike) {
        const { error } = await supabaseClient
            .from("video_likes")
            .delete()
            .eq("id", existingLike.id);

        if (error) {
            alert("Could not remove like: " + error.message);
            button.disabled = false;
            return;
        }
    } else {
        const { error } = await supabaseClient
            .from("video_likes")
            .insert({
                video_id: videoId,
                user_id: currentUser.id
            });

        if (error) {
            alert("Could not like video: " + error.message);
            button.disabled = false;
            return;
        }
    }

    await loadVideos();
}


// SEARCH VIDEOS

function searchVideos() {
    loadVideos();
}


// LOAD FEED WHEN PAGE OPENS

window.addEventListener("load", loadVideos);
