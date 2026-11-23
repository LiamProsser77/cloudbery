let currentUser = null;
let videoObserver = null;

async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
        currentUser = null;
        return;
    }

    currentUser = data.user;
}

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

    // Search video titles and creator names
    if (search) {
        results = results.filter(video =>
            video.title.toLowerCase().includes(search) ||
            video.creator.toLowerCase().includes(search)
        );
    }

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

        if (!currentUser) {
            likeButton.title = "Sign in to like videos";
        } else {
            likeButton.title = video.liked ? "Unlike video" : "Like video";
        }

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
        }
    }

    await loadVideos();
}

function searchVideos() {
    loadVideos();
}

window.addEventListener("load", loadVideos);
