class PoexCertificateEditor {
  constructor() {
    this.canvas = document.getElementById("certificateCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.manifestUrl = "templates/poex/poex-manifest.json";
    this.manifest = this.createFallbackManifest();
    this.templateImage = new Image();
    this.templateMeta = {
      width: 1536,
      height: 2752,
      groupLabel: "POEX 晋级图 中文",
      label: "POEX 晋级图 中文 01",
      indexLabel: "01"
    };
    this.pointerState = {
      dragging: false,
      layerKey: null,
      offsetX: 0,
      offsetY: 0,
      pointerId: null
    };

    this.textStyles = {
      name: {
        fontFamily: '"PoexNameFont"',
        fill: "#000000",
        shadow: false
      },
      uid: {
        fontFamily: '"PoexUidFont"',
        fill: "#000000",
        shadow: false
      }
    };

    this.defaultState = {
      templateGroup: "poex-upgrade-zh",
      templateIndex: 1,
      activeLayer: "avatar",
      nudgeStep: 4,
      avatar: {
        x: 563,
        y: 601,
        size: 416,
        minSize: 100,
        maxSize: 900,
        image: null,
        imageSrc: ""
      },
      name: {
        value: "",
        x: 773,
        y: 1202,
        fontSize: 92,
        minFontSize: 28,
        maxFontSize: 260,
        anchor: "baseline-center",
        styleKey: "name"
      },
      uid: {
        value: "",
        x: 834,
        y: 1326,
        fontSize: 54,
        minFontSize: 20,
        maxFontSize: 180,
        anchor: "baseline-center",
        styleKey: "uid"
      }
    };

    this.editorState = this.createInitialState();
    this.dom = {
      templateGroups: document.getElementById("templateGroups"),
      templateCount: document.getElementById("templateCount"),
      currentTemplateLabel: document.getElementById("currentTemplateLabel"),
      currentTemplateMeta: document.getElementById("currentTemplateMeta"),
      loadingOverlay: document.getElementById("loadingOverlay"),
      errorOverlay: document.getElementById("errorOverlay"),
      retryBtn: document.getElementById("retryBtn"),
      downloadBtn: document.getElementById("downloadBtn"),
      copyBtn: document.getElementById("copyBtn"),
      avatarUpload: document.getElementById("avatarUpload"),
      nameInput: document.getElementById("nameInput"),
      uidInput: document.getElementById("uidInput"),
      layerCards: Array.from(document.querySelectorAll(".layer-card")),
      numericInputs: {
        avatar: {},
        name: {},
        uid: {}
      }
    };
  }

  createFallbackManifest() {
    return {
      groups: [
        {
          key: "poex-upgrade-zh",
          label: "POEX 晋级图 中文",
          dir: "upgrade-zh",
          templates: Array.from({ length: 10 }, (_, index) => {
            const templateIndex = index + 1;
            const indexLabel = String(templateIndex).padStart(2, "0");
            return {
              index: templateIndex,
              label: indexLabel,
              src: `templates/poex/upgrade-zh/poex_upgrade_zh_${indexLabel}.png`
            };
          })
        }
      ]
    };
  }

  createInitialState() {
    return {
      templateGroup: this.defaultState.templateGroup,
      templateIndex: this.defaultState.templateIndex,
      activeLayer: this.defaultState.activeLayer,
      nudgeStep: this.defaultState.nudgeStep,
      avatar: {
        ...this.defaultState.avatar,
        image: null,
        imageSrc: ""
      },
      name: { ...this.defaultState.name },
      uid: { ...this.defaultState.uid }
    };
  }

  async init() {
    this.bindEvents();
    this.syncAllInputs();
    await this.loadFonts();
    await this.loadManifest();
    this.renderTemplateGroups();
    this.selectTemplate(this.editorState.templateGroup, this.editorState.templateIndex);
  }

  async loadFonts() {
    if (!document.fonts || !document.fonts.load) {
      return;
    }

    try {
      await Promise.all([
        document.fonts.load('96px "PoexNameFont"'),
        document.fonts.load('60px "PoexUidFont"')
      ]);
    } catch (error) {
      console.warn("字体未完全加载，继续使用页面预览。", error);
    }
  }

  async loadManifest() {
    try {
      const response = await fetch(this.manifestUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Manifest request failed: ${response.status}`);
      }
      const manifest = await response.json();
      this.manifest = this.normalizeManifest(manifest);
    } catch (error) {
      console.warn("Manifest 加载失败，使用内置模板清单。", error);
      this.manifest = this.normalizeManifest(this.createFallbackManifest());
    }
  }

  normalizeManifest(manifest) {
    const fallback = this.createFallbackManifest();
    const groups = Array.isArray(manifest?.groups) && manifest.groups.length > 0
      ? manifest.groups
      : fallback.groups;

    return {
      groups: groups.map((group, groupIndex) => {
        const safeKey = group.key || `group-${groupIndex + 1}`;
        const safeLabel = group.label || `模板组 ${groupIndex + 1}`;
        const templates = Array.isArray(group.templates) && group.templates.length > 0
          ? group.templates
          : [];

        return {
          key: safeKey,
          label: safeLabel,
          dir: group.dir || safeKey,
          templates: templates.map((template, templateIndex) => {
            const index = Number(template.index) || templateIndex + 1;
            const indexLabel = String(index).padStart(2, "0");
            return {
              index,
              label: template.label || indexLabel,
              src: template.src || `templates/poex/${group.dir}/${safeKey}_${indexLabel}.png`
            };
          })
        };
      })
    };
  }

  bindEvents() {
    this.dom.templateGroups.addEventListener("click", (event) => {
      const button = event.target.closest(".template-btn");
      if (!button) {
        return;
      }
      this.selectTemplate(button.dataset.group, Number(button.dataset.index));
    });

    this.dom.retryBtn.addEventListener("click", () => {
      this.loadCurrentTemplate();
    });

    this.dom.downloadBtn.addEventListener("click", () => this.downloadCertificate());
    this.dom.copyBtn.addEventListener("click", () => this.copyCertificate());

    this.dom.avatarUpload.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (file) {
        this.setActiveLayer("avatar");
        this.loadAvatarFromFile(file);
      }
    });

    this.dom.nameInput.addEventListener("input", () => {
      this.editorState.name.value = this.dom.nameInput.value;
      this.setActiveLayer("name");
      this.draw();
    });

    this.dom.uidInput.addEventListener("input", () => {
      this.editorState.uid.value = this.dom.uidInput.value;
      this.setActiveLayer("uid");
      this.draw();
    });
    this.bindNumericInputs();
    this.bindLayerControls();
    this.bindCanvasEvents();
    document.addEventListener("paste", (event) => this.handlePaste(event));
  }

  bindNumericInputs() {
    Object.entries(this.dom.numericInputs).forEach(([layerKey, fields]) => {
      Object.entries(fields).forEach(([key, input]) => {
        input.addEventListener("input", () => {
          this.setActiveLayer(layerKey);
          this.updateLayerNumeric(layerKey, key, input.value);
        });
      });
    });
  }

  bindLayerControls() {
    this.dom.layerCards.forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("input") || event.target.closest("button")) {
          return;
        }
        this.setActiveLayer(card.dataset.layer);
      });
    });

    document.querySelectorAll("[data-scale]").forEach((button) => {
      button.addEventListener("click", () => {
        const layerKey = button.dataset.layer;
        const direction = Number(button.dataset.scale);
        this.setActiveLayer(layerKey);
        this.resizeLayer(layerKey, direction);
      });
    });
  }

  bindCanvasEvents() {
    this.canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.handlePointerHover(event));
    this.canvas.addEventListener("pointerleave", () => {
      if (!this.pointerState.dragging) {
        this.canvas.style.cursor = "default";
      }
    });

    window.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    window.addEventListener("pointerup", () => this.handlePointerUp());
    window.addEventListener("pointercancel", () => this.handlePointerUp());
  }

  handlePointerDown(event) {
    const point = this.getCanvasPoint(event);
    const layerKey = this.hitTest(point.x, point.y);
    if (!layerKey) {
      return;
    }

    event.preventDefault();
    this.setActiveLayer(layerKey);
    this.pointerState.dragging = true;
    this.pointerState.layerKey = layerKey;
    this.pointerState.pointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);

    const layer = this.editorState[layerKey];
    this.pointerState.offsetX = point.x - layer.x;
    this.pointerState.offsetY = point.y - layer.y;
    this.canvas.style.cursor = "grabbing";
  }

  handlePointerMove(event) {
    if (!this.pointerState.dragging) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const layerKey = this.pointerState.layerKey;
    if (!layerKey) {
      return;
    }

    const layer = this.editorState[layerKey];
    layer.x = Math.round(point.x - this.pointerState.offsetX);
    layer.y = Math.round(point.y - this.pointerState.offsetY);
    this.clampLayer(layerKey);
    this.syncLayerInputs(layerKey);
    this.draw();
  }

  handlePointerUp() {
    if (!this.pointerState.dragging) {
      return;
    }

    this.pointerState.dragging = false;
    this.pointerState.layerKey = null;
    this.pointerState.pointerId = null;
    this.canvas.style.cursor = "default";
  }

  handlePointerHover(event) {
    if (this.pointerState.dragging) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const hitLayer = this.hitTest(point.x, point.y);
    this.canvas.style.cursor = hitLayer ? "grab" : "default";
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  hitTest(x, y) {
    const order = [this.editorState.activeLayer, "uid", "name", "avatar"];
    const uniqueKeys = order.filter((key, index) => order.indexOf(key) === index);
    return uniqueKeys.find((layerKey) => this.layerContainsPoint(layerKey, x, y)) || null;
  }

  layerContainsPoint(layerKey, x, y) {
    if (layerKey === "avatar") {
      const avatar = this.editorState.avatar;
      const radius = avatar.size / 2;
      const centerX = avatar.x + radius;
      const centerY = avatar.y + radius;
      const distance = Math.hypot(x - centerX, y - centerY);
      return distance <= radius + 18;
    }

    if (!this.getDisplayValue(layerKey)) {
      return false;
    }

    const bounds = this.getTextBounds(layerKey);
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }

  getTextBounds(layerKey) {
    const metrics = this.measureTextLayer(layerKey);
    const layer = this.editorState[layerKey];
    const horizontalPadding = Math.max(18, layer.fontSize * 0.18);
    const verticalPadding = Math.max(16, layer.fontSize * 0.18);
    const left = layer.anchor === "baseline-center"
      ? layer.x - metrics.width / 2 - horizontalPadding
      : layer.x - horizontalPadding;
    const right = layer.anchor === "baseline-center"
      ? layer.x + metrics.width / 2 + horizontalPadding
      : layer.x + metrics.width + horizontalPadding;

    return {
      left,
      right,
      top: layer.y - metrics.ascent - verticalPadding,
      bottom: layer.y + metrics.descent + verticalPadding,
      width: right - left,
      height: metrics.ascent + metrics.descent + verticalPadding * 2
    };
  }

  measureTextLayer(layerKey) {
    const layer = this.editorState[layerKey];
    const style = this.textStyles[layer.styleKey];
    const displayValue = this.getDisplayValue(layerKey);

    if (!displayValue) {
      return {
        width: 0,
        ascent: 0,
        descent: 0
      };
    }

    this.ctx.save();
    this.ctx.font = `${layer.fontSize}px ${style.fontFamily}, serif`;
    const metrics = this.ctx.measureText(displayValue);
    this.ctx.restore();

    return {
      width: metrics.width,
      ascent: metrics.actualBoundingBoxAscent || layer.fontSize * 0.74,
      descent: metrics.actualBoundingBoxDescent || layer.fontSize * 0.26
    };
  }

  renderTemplateGroups() {
    const totalTemplates = this.manifest.groups.reduce((sum, group) => sum + group.templates.length, 0);
    this.dom.templateCount.textContent = `${totalTemplates} 张`;

    this.dom.templateGroups.innerHTML = this.manifest.groups.map((group) => {
      const buttons = group.templates.map((template) => `
        <button
          type="button"
          class="template-btn"
          data-group="${group.key}"
          data-index="${template.index}"
        >${template.label}</button>
      `).join("");

      return `
        <section class="template-group">
          <div class="template-group-header">
            <div class="template-group-title">
              <strong>${group.label}</strong>
              <span>${group.templates.length} 张模板</span>
            </div>
            <span class="template-total">已接入</span>
          </div>
          <div class="template-grid">${buttons}</div>
        </section>
      `;
    }).join("");

    this.updateTemplateButtons();
  }

  getGroupConfig(groupKey) {
    return this.manifest.groups.find((group) => group.key === groupKey) || this.manifest.groups[0];
  }

  getTemplateConfig(groupKey, index) {
    const group = this.getGroupConfig(groupKey);
    const template = group.templates.find((item) => item.index === index) || group.templates[0];
    const indexLabel = String(template.index).padStart(2, "0");
    return {
      groupKey: group.key,
      groupLabel: group.label,
      index: template.index,
      indexLabel,
      label: `${group.label} ${indexLabel}`,
      src: template.src
    };
  }

  selectTemplate(groupKey, index) {
    this.editorState.templateGroup = groupKey;
    this.editorState.templateIndex = index;
    this.updateTemplateButtons();
    this.loadCurrentTemplate();
  }

  updateTemplateButtons() {
    document.querySelectorAll(".template-btn").forEach((button) => {
      const isActive = button.dataset.group === this.editorState.templateGroup
        && Number(button.dataset.index) === this.editorState.templateIndex;
      button.classList.toggle("active", isActive);
    });
  }

  loadCurrentTemplate() {
    const template = this.getTemplateConfig(this.editorState.templateGroup, this.editorState.templateIndex);
    const image = new Image();

    this.showLoading();
    this.hideError();

    image.onload = () => {
      this.templateImage = image;
      this.templateMeta = {
        width: image.naturalWidth,
        height: image.naturalHeight,
        groupLabel: template.groupLabel,
        label: template.label,
        indexLabel: template.indexLabel
      };
      this.canvas.width = image.naturalWidth;
      this.canvas.height = image.naturalHeight;
      this.updateTemplateSummary();
      this.hideLoading();
      this.draw();
    };

    image.onerror = () => {
      this.hideLoading();
      this.showError();
    };

    image.src = template.src;
  }

  updateTemplateSummary() {
    this.dom.currentTemplateLabel.textContent = this.templateMeta.label;
    this.dom.currentTemplateMeta.textContent = `${this.templateMeta.width} x ${this.templateMeta.height}`;
  }

  setActiveLayer(layerKey) {
    if (!this.editorState[layerKey]) {
      return;
    }

    this.editorState.activeLayer = layerKey;
  }

  syncAllInputs() {
    this.dom.nameInput.value = this.editorState.name.value;
    this.dom.uidInput.value = this.editorState.uid.value;
    this.syncLayerInputs("avatar");
    this.syncLayerInputs("name");
    this.syncLayerInputs("uid");
  }

  syncLayerInputs(layerKey) {
    const layer = this.editorState[layerKey];
    Object.entries(this.dom.numericInputs[layerKey]).forEach(([key, input]) => {
      input.value = Math.round(layer[key]);
    });
  }

  updateLayerNumeric(layerKey, key, rawValue) {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    const layer = this.editorState[layerKey];
    if (key === "size") {
      layer.size = this.clamp(nextValue, layer.minSize, layer.maxSize);
    } else if (key === "fontSize") {
      layer.fontSize = this.clamp(nextValue, layer.minFontSize, layer.maxFontSize);
    } else {
      layer[key] = Math.round(nextValue);
    }

    this.clampLayer(layerKey);
    this.syncLayerInputs(layerKey);
    this.draw();
  }

  nudgeLayer(layerKey, dx, dy) {
    const layer = this.editorState[layerKey];
    layer.x += dx;
    layer.y += dy;
    this.clampLayer(layerKey);
    this.syncLayerInputs(layerKey);
    this.draw();
  }

  resizeLayer(layerKey, direction) {
    const layer = this.editorState[layerKey];
    if (layerKey === "avatar") {
      layer.size = this.clamp(layer.size + direction * 12, layer.minSize, layer.maxSize);
    } else {
      layer.fontSize = this.clamp(layer.fontSize + direction * 4, layer.minFontSize, layer.maxFontSize);
    }
    this.clampLayer(layerKey);
    this.syncLayerInputs(layerKey);
    this.draw();
  }

  clampLayer(layerKey) {
    const layer = this.editorState[layerKey];

    if (layerKey === "avatar") {
      layer.x = this.clamp(layer.x, 0, Math.max(0, this.canvas.width - layer.size));
      layer.y = this.clamp(layer.y, 0, Math.max(0, this.canvas.height - layer.size));
      return;
    }

    layer.x = this.clamp(layer.x, 0, this.canvas.width);
    layer.y = this.clamp(layer.y, 0, this.canvas.height);
  }

  clamp(value, minValue, maxValue) {
    return Math.min(maxValue, Math.max(minValue, Math.round(value)));
  }

  handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
      return;
    }

    event.preventDefault();
    this.setActiveLayer("avatar");
    this.loadAvatarFromFile(file);
  }

  loadAvatarFromFile(file) {
    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const avatarImage = new Image();
      avatarImage.onload = () => {
        this.editorState.avatar.image = avatarImage;
        this.editorState.avatar.imageSrc = event.target.result;
        this.draw();
      };
      avatarImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  draw() {
    if (!this.templateImage.complete) {
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.templateImage, 0, 0, this.canvas.width, this.canvas.height);
    this.drawAvatarLayer();
    this.drawTextLayer("name");
    this.drawTextLayer("uid");
  }

  drawAvatarLayer() {
    const avatar = this.editorState.avatar;
    if (!avatar.image) {
      return;
    }

    const borderWidth = 4;
    const radius = avatar.size / 2;
    const centerX = avatar.x + radius;
    const centerY = avatar.y + radius;
    const cropSize = Math.min(avatar.image.width, avatar.image.height);
    const sourceX = (avatar.image.width - cropSize) / 2;
    const sourceY = (avatar.image.height - cropSize) / 2;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.closePath();
    this.ctx.clip();
    this.ctx.drawImage(
      avatar.image,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      avatar.x,
      avatar.y,
      avatar.size,
      avatar.size
    );
    this.ctx.restore();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius - borderWidth / 2, 0, Math.PI * 2);
    this.ctx.closePath();
    this.ctx.strokeStyle = "rgba(223, 191, 125, 0.92)";
    this.ctx.lineWidth = borderWidth;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = "rgba(223, 191, 125, 0.24)";
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawTextLayer(layerKey) {
    const layer = this.editorState[layerKey];
    const style = this.textStyles[layer.styleKey];
    const displayValue = this.getDisplayValue(layerKey);
    if (!displayValue) {
      return;
    }

    this.ctx.save();
    this.ctx.font = `${layer.fontSize}px ${style.fontFamily}, serif`;
    this.ctx.textAlign = layer.anchor === "baseline-center" ? "center" : "left";
    this.ctx.textBaseline = "alphabetic";

    if (style.shadow) {
      this.ctx.globalAlpha = 0.28;
      this.ctx.fillStyle = "#000000";
      this.ctx.fillText(displayValue, layer.x, layer.y + Math.max(2, Math.round(layer.fontSize * 0.05)));
    }

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = style.fill;
    this.ctx.fillText(displayValue, layer.x, layer.y);
    this.ctx.restore();
  }

  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  getDisplayValue(layerKey) {
    const layer = this.editorState[layerKey];
    return layer.value.trim();
  }

  showLoading() {
    this.dom.loadingOverlay.classList.remove("hidden");
  }

  hideLoading() {
    this.dom.loadingOverlay.classList.add("hidden");
  }

  showError() {
    this.dom.errorOverlay.classList.remove("hidden");
  }

  hideError() {
    this.dom.errorOverlay.classList.add("hidden");
  }

  downloadCertificate() {
    if (!this.templateImage.complete) {
      return;
    }

    const link = document.createElement("a");
    const safeGroupLabel = this.templateMeta.groupLabel.replace(/\s+/g, "_").replace(/[^\w\u4e00-\u9fa5-]/g, "");
    link.download = `POEX证书_${safeGroupLabel}_${this.templateMeta.indexLabel}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }

  async copyCertificate() {
    if (!window.ClipboardItem || !navigator.clipboard) {
      window.alert("当前浏览器不支持复制图片，请使用下载 PNG。");
      return;
    }

    this.canvas.toBlob(async (blob) => {
      if (!blob) {
        window.alert("复制失败，请改用下载 PNG。");
        return;
      }

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob
          })
        ]);
        this.flashActionButton(this.dom.copyBtn, "已复制");
      } catch (error) {
        console.error("复制图片失败：", error);
        window.alert("复制失败，请改用下载 PNG。");
      }
    }, "image/png");
  }

  flashActionButton(button, text) {
    const previousText = button.textContent;
    button.textContent = text;
    button.style.borderColor = "rgba(255, 214, 123, 0.4)";
    button.style.background = "rgba(255, 214, 123, 0.18)";

    window.setTimeout(() => {
      button.textContent = previousText;
      button.style.borderColor = "";
      button.style.background = "";
    }, 1600);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const editor = new PoexCertificateEditor();
  editor.init();
});
