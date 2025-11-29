(function () {
  function showVideoPlayOverlay(container, video) {
    try {
      if (!container || !video) return;
      if (container.querySelector(".video-overlay")) return;

      var overlay = document.createElement("div");
      overlay.className = "video-overlay";
      overlay.setAttribute("role", "region");
      overlay.setAttribute("aria-label", "Video playback control");

      var btn = document.createElement("button");
      btn.className = "video-play-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Play video");
      btn.innerHTML = "▶";

      overlay.appendChild(btn);

      // ensure container is positioned for absolute overlay
      var computed = window.getComputedStyle(container);
      if (computed.position === "static" || !computed.position) {
        container.style.position = "relative";
      }

      container.appendChild(overlay);

      function cleanUp() {
        try {
          overlay.remove();
        } catch (e) {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
      }

      function tryPlay() {
        // ensure muted to maximize autoplay chances
        try {
          video.muted = true;
        } catch (e) {}
        var p = video.play();
        if (p && typeof p.then === "function") {
          p.then(function () {
            cleanUp();
          }).catch(function () {
            /* keep overlay */
          });
        } else {
          // If play() is not a promise, just remove overlay and hope for the best
          cleanUp();
        }
      }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        tryPlay();
      });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) tryPlay();
      });
      overlay.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          tryPlay();
        }
      });

      // Make the overlay itself focusable for keyboard users
      overlay.tabIndex = 0;
      // Focus button for immediate activation
      btn.focus();
    } catch (err) {
      console.error("showVideoPlayOverlay error", err);
    }
  }

  // expose globally
  window.showVideoPlayOverlay = showVideoPlayOverlay;

  /**
   * Try to replace a blocked video with an animated image fallback (WebP, then GIF).
   * Tries Cloudinary transformation URLs first, then fallback filename variants.
   * Returns a Promise resolving to true if replaced, false otherwise.
   */
  function attemptAnimatedImageFallback(
    container,
    video,
    mediaUrl,
    caption,
    animatedWebpUrl
  ) {
    return new Promise((resolve) => {
      if (!container || !video || !mediaUrl) return resolve(false);

      console.debug(
        "attemptAnimatedImageFallback: trying to replace blocked video",
        mediaUrl
      );

      // Candidate animated image URLs
      const candidates = [];

      // If explicit animated WebP URL provided (best case), try first
      if (animatedWebpUrl) candidates.push(animatedWebpUrl);

      // Try Cloudinary transformations (e.g., convert webm to animated webp via CDN)
      if (mediaUrl.includes("cloudinary")) {
        candidates.push(
          mediaUrl
            .replace(/\/upload\//i, "/upload/f_webp,q_auto:eco/")
            .replace(/\.webm$/i, "")
        );
      }

      // Fallback to simple filename swaps
      candidates.push(mediaUrl.replace(/\.webm$/i, ".webp"));
      candidates.push(mediaUrl.replace(/\.webm$/i, ".gif"));

      let tried = 0;

      function tryNext() {
        if (tried >= candidates.length) {
          console.debug("attemptAnimatedImageFallback: all candidates exhausted");
          try {
            const dbg = container.querySelector(".fallback-debug");
            if (dbg) dbg.textContent = "No animated fallback available";
          } catch (e) {}
          return resolve(false);
        }
        const url = candidates[tried++];
        console.debug(
          `attemptAnimatedImageFallback: trying candidate ${tried}/${candidates.length}: ${url}`
        );

        // update (or create) visible debug badge inside the container for mobile troubleshooting
        try {
          let dbg = container.querySelector(".fallback-debug");
          if (!dbg) {
            dbg = document.createElement("div");
            dbg.className = "fallback-debug";
            dbg.setAttribute("aria-hidden", "true");
            // ensure container is positioned for absolute badge
            const cStyle = window.getComputedStyle(container);
            if (cStyle.position === "static" || !cStyle.position)
              container.style.position = "relative";
            container.appendChild(dbg);
          }
          dbg.textContent = `Trying: ${url}`;
        } catch (e) {
          /* ignore DOM badge errors */
        }

        const img = new Image();
        img.onload = function () {
          console.debug(
            "attemptAnimatedImageFallback: candidate loaded successfully"
          );
          try {
            // Remove video element and insert animated image
            if (video && video.parentNode) video.parentNode.removeChild(video);
            img.alt = caption || "";
            img.className = "animated-fallback";
            img.style.width = "100%";
            img.style.height = "auto";
            img.loading = "eager";
            // Insert into container (prefer before figcaption if present)
            const figcap = container.querySelector("figcaption");
            if (figcap) container.insertBefore(img, figcap);
            else container.appendChild(img);
            try {
              const dbg = container.querySelector(".fallback-debug");
              if (dbg) dbg.textContent = "Animated fallback loaded";
            } catch (e) {}
            return resolve(true);
          } catch (e) {
            console.debug(
              "attemptAnimatedImageFallback: insertion failed, trying next",
              e
            );
            tryNext();
          }
        };
        img.onerror = function () {
          console.debug(
            "attemptAnimatedImageFallback: candidate failed to load",
            url
          );
          tryNext();
        };
        img.src = url;
      }

      tryNext();
    });
  }

  window.attemptAnimatedImageFallback = attemptAnimatedImageFallback;
})();
