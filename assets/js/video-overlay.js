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

      if (animatedWebpUrl) candidates.push(animatedWebpUrl);

      if (mediaUrl.includes("cloudinary")) {
        candidates.push(
          mediaUrl
            .replace(/\/upload\//i, "/upload/f_webp,q_auto:eco/")
            .replace(/\.webm$/i, "")
        );
      }
      candidates.push(mediaUrl.replace(/\.webm$/i, ".mp4"));
      candidates.push(mediaUrl.replace(/\.webm$/i, ".webp"));
      candidates.push(mediaUrl.replace(/\.webm$/i, ".gif"));

      let tried = 0;

      function tryNext() {
        if (tried >= candidates.length) {
          // Only show fallback debug overlay if ALL candidates fail
          try {
            const dbg = container.querySelector(".fallback-debug");
            if (!dbg) {
              const newDbg = document.createElement("div");
              newDbg.className = "fallback-debug";
              newDbg.setAttribute("aria-hidden", "true");
              const cStyle = window.getComputedStyle(container);
              if (cStyle.position === "static" || !cStyle.position)
                container.style.position = "relative";
              container.appendChild(newDbg);
              newDbg.textContent = "No animated fallback available";
            } else {
              dbg.textContent = "No animated fallback available";
            }
          } catch (e) {}
          return resolve(false);
        }

        const url = candidates[tried++];
        console.debug(
          `attemptAnimatedImageFallback: trying candidate ${tried}/${candidates.length}: ${url}`
        );

        // Optionally show debug info for troubleshooting, but remove on success
        try {
          let dbg = container.querySelector(".fallback-debug");
          if (!dbg) {
            dbg = document.createElement("div");
            dbg.className = "fallback-debug";
            dbg.setAttribute("aria-hidden", "true");
            const cStyle = window.getComputedStyle(container);
            if (cStyle.position === "static" || !cStyle.position)
              container.style.position = "relative";
            container.appendChild(dbg);
          }
          dbg.textContent = `Trying: ${url}`;
        } catch (e) {}

        const isVideo = /\.mp4$/i.test(url);

        if (isVideo) {
          const testVid = document.createElement("video");
          testVid.src = url;
          testVid.muted = true;
          testVid.crossOrigin = "anonymous";

          let loaded = false;

          const onCanPlay = function () {
            if (loaded) return;
            loaded = true;
            cleanup();
            try {
              if (video && video.parentNode)
                video.parentNode.removeChild(video);

              const element = document.createElement("video");
              element.autoplay = true;
              element.muted = true;
              element.loop = true;
              element.playsinline = true;
              element.preload = "metadata";
              element.className = "animated-fallback";
              element.style.width = "100%";
              element.style.height = "auto";
              element.style.display = "block";
              element.style.borderRadius = "8px";
              element.style.maxWidth = "100%";
              element.style.objectFit = "contain";
              const source = document.createElement("source");
              source.src = url;
              source.type = "video/mp4";
              element.appendChild(source);
              const figcap = container.querySelector("figcaption");
              if (figcap) container.insertBefore(element, figcap);
              else container.insertBefore(element, container.firstChild);

              // REMOVE fallback debug overlay, if present, since we loaded successfully
              const dbg = container.querySelector(".fallback-debug");
              if (dbg) dbg.remove();

              resolve(true);
            } catch (err) {
              console.error(
                "attemptAnimatedImageFallback: error creating video element",
                err
              );
              tryNext();
            }
          };

          const onError = function () {
            console.debug(
              "attemptAnimatedImageFallback: video candidate failed to load"
            );
            cleanup();
            tryNext();
          };

          const cleanup = function () {
            testVid.removeEventListener("canplay", onCanPlay);
            testVid.removeEventListener("error", onError);
          };

          testVid.addEventListener("canplay", onCanPlay);
          testVid.addEventListener("error", onError);

          const timeoutId = setTimeout(function () {
            if (!loaded && testVid.readyState === 0) {
              console.debug(
                "attemptAnimatedImageFallback: video candidate timeout"
              );
              cleanup();
              tryNext();
            }
          }, 5000);

          testVid.addEventListener("canplay", function () {
            clearTimeout(timeoutId);
          });
        } else {
          const img = new Image();
          img.crossOrigin = "anonymous";

          img.onload = function () {
            console.debug(
              "attemptAnimatedImageFallback: image candidate loaded successfully"
            );
            try {
              if (video && video.parentNode)
                video.parentNode.removeChild(video);

              img.alt = caption || "";
              img.className = "animated-fallback";
              img.style.width = "100%";
              img.style.height = "auto";
              img.loading = "eager";
              img.style.display = "block";
              img.style.borderRadius = "8px";
              img.style.maxWidth = "100%";

              const figcap = container.querySelector("figcaption");
              if (figcap) container.insertBefore(img, figcap);
              else container.insertBefore(img, container.firstChild);

              // REMOVE fallback debug overlay, if present, since we loaded successfully
              const dbg = container.querySelector(".fallback-debug");
              if (dbg) dbg.remove();

              resolve(true);
            } catch (e) {
              tryNext();
            }
          };

          img.onerror = function () {
            console.debug(
              "attemptAnimatedImageFallback: image candidate failed to load",
              url
            );
            tryNext();
          };

          img.src = url;
        }
      }

      tryNext();
    });
  }

  window.attemptAnimatedImageFallback = attemptAnimatedImageFallback;
})();
