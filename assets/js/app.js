class PoexCertificateEditor {
  constructor() {
    this.canvas = document.getElementById("certificateCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.manifestUrl = "templates/poex/poex-manifest.json";
    this.manifest = this.createFallbackManifest();
    this.templateImage = new Image();
    this.templateMeta = {
      width: 0,
      height: 0,
      groupLabel: "",
      label: "未接入模板",
      indexLabel: ""
    };
    this.pointerState = {
      dragging: false,
      layerKey: null,
      offsetX: 0,
      offsetY: 0,
      pointerId: null
    };
    this.expandedGroupKey = "poex-reward-en";

    this.textStyles = {
      nameZh: {
        fontFamily: '"PoexNameFont"',
        fill: "#000000",
        shadow: false
      },
      uidZh: {
        fontFamily: '"PoexUidFont"',
        fill: "#000000",
        shadow: false
      },
      nameIntl: {
        fontFamily: '"Lora"',
        fontWeight: "500",
        shadow: false,
        gradient: {
          angle: 180,
          stops: [
            { offset: 0, color: "#b78a3d" },
            { offset: 0.35, color: "#c99d48" },
            { offset: 0.72, color: "#ffe7aa" },
            { offset: 1, color: "#e1be66" }
          ]
        }
      },
      uidIntl: {
        fontFamily: '"Lora"',
        fontWeight: "500",
        shadow: false,
        gradient: {
          angle: 135,
          stops: [
            { offset: 0, color: "#ffe7aa" },
            { offset: 1, color: "#e1be66" }
          ]
        }
      }
    };

    this.defaultState = {
      templateGroup: "poex-reward-en",
      templateIndex: 1,
      activeLayer: "avatar",
      nudgeStep: 1,
      avatar: {
        x: 186,
        y: 327,
        width: 179,
        height: 215,
        minWidth: 80,
        maxWidth: 520,
        aspectRatio: 179 / 215,
        shape: "ellipse",
        frameSrc: "",
        frameImage: null,
        image: null,
        imageSrc: ""
      },
      name: {
        value: "",
        x: 460,
        y: 812,
        fontSize: 46,
        minFontSize: 28,
        maxFontSize: 260,
        anchor: "left",
        styleKey: "nameZh"
      },
      uid: {
        value: "",
        x: 120,
        y: 688,
        fontSize: 30,
        minFontSize: 20,
        maxFontSize: 180,
        anchor: "left",
        styleKey: "uidZh"
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
      actionStatus: document.getElementById("actionStatus"),
      avatarUpload: document.getElementById("avatarUpload"),
      nameInput: document.getElementById("nameInput"),
      uidInput: document.getElementById("uidInput"),
      numericInputs: {
        avatar: {},
        name: {},
        uid: {}
      }
    };
  }

  createFallbackManifest() {
    return {
      groups: []
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
        frameImage: null,
        image: null,
        imageSrc: ""
      },
      name: { ...this.defaultState.name },
      uid: { ...this.defaultState.uid }
    };
  }

  normalizeGroupConfig(config = {}) {
    const defaultAvatar = this.defaultState.avatar;
    const defaultName = this.defaultState.name;
    const defaultUid = this.defaultState.uid;
    const avatarWidth = Number(config.avatar?.width) || defaultAvatar.width;
    const avatarHeight = Number(config.avatar?.height) || defaultAvatar.height;

    return {
      nudgeStep: Number(config.nudgeStep) || this.defaultState.nudgeStep,
      avatar: {
        x: Number(config.avatar?.x) || defaultAvatar.x,
        y: Number(config.avatar?.y) || defaultAvatar.y,
        width: avatarWidth,
        height: avatarHeight,
        minWidth: Number(config.avatar?.minWidth) || defaultAvatar.minWidth,
        maxWidth: Number(config.avatar?.maxWidth) || defaultAvatar.maxWidth,
        aspectRatio: Number(config.avatar?.aspectRatio) || (avatarWidth / avatarHeight) || defaultAvatar.aspectRatio,
        shape: config.avatar?.shape || defaultAvatar.shape,
        frameSrc: config.avatar?.frameSrc || "",
        frameImage: null
      },
      name: {
        x: Number(config.name?.x) || defaultName.x,
        y: Number(config.name?.y) || defaultName.y,
        fontSize: Number(config.name?.fontSize) || defaultName.fontSize,
        anchor: config.name?.anchor || defaultName.anchor
      },
      uid: {
        x: Number(config.uid?.x) || defaultUid.x,
        y: Number(config.uid?.y) || defaultUid.y,
        fontSize: Number(config.uid?.fontSize) || defaultUid.fontSize,
        anchor: config.uid?.anchor || defaultUid.anchor
      }
    };
  }

  async init() {
    this.bindEvents();
    this.syncAllInputs();
    this.setActionAvailability(false);
    this.setStatus("正在加载模板...", "muted");
    await this.loadFonts();
    await this.loadManifest();
    this.renderTemplateGroups();
    const preferredTemplate = this.getTemplateConfig(this.defaultState.templateGroup, this.defaultState.templateIndex)
      || this.getFirstTemplateConfig();
    if (preferredTemplate) {
      this.selectTemplate(preferredTemplate.groupKey, preferredTemplate.index);
      return;
    }

    this.setNoTemplateState();
  }

  async loadFonts() {
    if (!document.fonts || !document.fonts.load) {
      return;
    }

    try {
      await Promise.all([
        document.fonts.load('96px "PoexNameFont"'),
        document.fonts.load('60px "PoexUidFont"'),
        document.fonts.load('600 60px "Lora"')
      ]);
    } catch (error) {
      console.warn("字体未完全加载，继续使用页面预览。", error);
    }
  }

  loadImageAsset(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }

      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
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
    const groups = Array.isArray(manifest?.groups)
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
          config: this.normalizeGroupConfig(group.config),
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
      const trigger = event.target.closest(".template-group-header");
      if (trigger) {
        this.toggleTemplateGroup(trigger.dataset.group);
        return;
      }

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
    this.dom.nameInput.addEventListener("focus", () => this.setActiveLayer("name"));

    this.dom.uidInput.addEventListener("input", () => {
      this.editorState.uid.value = this.dom.uidInput.value;
      this.setActiveLayer("uid");
      this.draw();
    });
    this.dom.uidInput.addEventListener("focus", () => this.setActiveLayer("uid"));
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
      if (avatar.shape === "ellipse") {
        const centerX = avatar.x + avatar.width / 2;
        const centerY = avatar.y + avatar.height / 2;
        const radiusX = avatar.width / 2 + 10;
        const radiusY = avatar.height / 2 + 10;
        const normalized = ((x - centerX) ** 2) / (radiusX ** 2) + ((y - centerY) ** 2) / (radiusY ** 2);
        return normalized <= 1;
      }

      return x >= avatar.x
        && x <= avatar.x + avatar.width
        && y >= avatar.y
        && y <= avatar.y + avatar.height;
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
    this.ctx.font = `${style.fontWeight ? `${style.fontWeight} ` : ""}${layer.fontSize}px ${style.fontFamily}, serif`;
    const metrics = this.ctx.measureText(displayValue);
    this.ctx.restore();

    return {
      width: metrics.width,
      ascent: metrics.actualBoundingBoxAscent || layer.fontSize * 0.74,
      descent: metrics.actualBoundingBoxDescent || layer.fontSize * 0.26
    };
  }

  createTextGradient(bounds, style) {
    const angle = (style.gradient?.angle ?? 180) * (Math.PI / 180);
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const halfWidth = bounds.width / 2;
    const halfHeight = (bounds.bottom - bounds.top) / 2;
    const gradientRadius = Math.max(halfWidth, halfHeight);
    const dx = Math.sin(angle) * gradientRadius;
    const dy = Math.cos(angle) * gradientRadius;
    const gradient = this.ctx.createLinearGradient(
      centerX - dx,
      centerY - dy,
      centerX + dx,
      centerY + dy
    );

    style.gradient.stops.forEach((stop) => {
      gradient.addColorStop(stop.offset, stop.color);
    });

    return gradient;
  }

  renderTemplateGroups() {
    const totalTemplates = this.manifest.groups.reduce((sum, group) => sum + group.templates.length, 0);
    this.dom.templateCount.textContent = `${totalTemplates} 个模板`;

    if (this.manifest.groups.length === 0) {
      this.dom.templateGroups.innerHTML = `
        <section class="template-empty">
          <strong>当前没有接入模板</strong>
          <p>旧模板已清理完成，下一步可以接入新的模板图片和配置。</p>
        </section>
      `;
      return;
    }

    this.dom.templateGroups.innerHTML = this.manifest.groups.map((group) => {
      const isExpanded = group.key === this.expandedGroupKey;
      const buttons = group.templates.map((template) => `
        <button
          type="button"
          class="template-btn"
          data-group="${group.key}"
          data-index="${template.index}"
        >${template.label}</button>
      `).join("");

      return `
        <section class="template-group ${isExpanded ? "" : "is-collapsed"}">
          <button
            type="button"
            class="template-group-header"
            data-group="${group.key}"
            aria-expanded="${isExpanded ? "true" : "false"}"
          >
            <div class="template-group-title">
              <span class="template-group-tag">Template Set</span>
              <strong>${group.label}</strong>
            </div>
            <span class="template-group-count">${group.templates.length}</span>
            <span class="template-group-caret">▾</span>
          </button>
          <div class="template-grid">${buttons}</div>
        </section>
      `;
    }).join("");

    this.updateTemplateButtons();
  }

  toggleTemplateGroup(groupKey) {
    this.expandedGroupKey = this.expandedGroupKey === groupKey ? null : groupKey;
    this.renderTemplateGroups();
  }

  getGroupConfig(groupKey) {
    if (this.manifest.groups.length === 0) {
      return null;
    }

    return this.manifest.groups.find((group) => group.key === groupKey) || this.manifest.groups[0];
  }

  getTemplateConfig(groupKey, index) {
    const group = this.getGroupConfig(groupKey);
    if (!group || !Array.isArray(group.templates) || group.templates.length === 0) {
      return null;
    }

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

  getFirstTemplateConfig() {
    const firstGroup = this.manifest.groups[0];
    if (!firstGroup || !Array.isArray(firstGroup.templates) || firstGroup.templates.length === 0) {
      return null;
    }

    return this.getTemplateConfig(firstGroup.key, firstGroup.templates[0].index);
  }

  async applyGroupConfig(groupKey) {
    const group = this.getGroupConfig(groupKey);
    if (!group?.config) {
      return;
    }

    const avatarImage = this.editorState.avatar.image;
    const avatarImageSrc = this.editorState.avatar.imageSrc;
    const frameImage = await this.loadImageAsset(group.config.avatar.frameSrc);

    this.editorState.nudgeStep = group.config.nudgeStep;
    this.editorState.avatar = {
      ...this.editorState.avatar,
      ...group.config.avatar,
      frameImage,
      image: avatarImage,
      imageSrc: avatarImageSrc
    };
    this.editorState.name = {
      ...this.editorState.name,
      ...group.config.name,
      styleKey: group.key === "poex-upgrade-zh" ? "nameZh" : "nameIntl"
    };
    this.editorState.uid = {
      ...this.editorState.uid,
      ...group.config.uid,
      styleKey: group.key === "poex-upgrade-zh" ? "uidZh" : "uidIntl"
    };
  }

  async selectTemplate(groupKey, index) {
    const template = this.getTemplateConfig(groupKey, index);
    if (!template) {
      this.setNoTemplateState();
      return;
    }

    const groupChanged = this.editorState.templateGroup !== groupKey;
    if (groupChanged) {
      await this.applyGroupConfig(groupKey);
    }

    this.expandedGroupKey = groupKey;
    this.editorState.templateGroup = groupKey;
    this.editorState.templateIndex = index;
    this.syncAllInputs();
    this.renderTemplateGroups();
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
    if (!template) {
      this.setNoTemplateState();
      return;
    }

    const image = new Image();

    this.setActionAvailability(false);
    this.setStatus(`正在加载 ${template.label}...`, "muted");
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
      this.setActionAvailability(true);
      this.setStatus(`已切换到 ${template.label}，可以继续生成或下载。`, "success");
      this.draw();
    };

    image.onerror = () => {
      this.hideLoading();
      this.setActionAvailability(false);
      this.setStatus(`模板加载失败：${template.label}`, "error");
      this.showError();
    };

    image.src = template.src;
  }

  updateTemplateSummary() {
    this.dom.currentTemplateLabel.textContent = this.templateMeta.label;
    if (this.templateMeta.width && this.templateMeta.height) {
      this.dom.currentTemplateMeta.textContent = `${this.templateMeta.width} x ${this.templateMeta.height}`;
      return;
    }

    this.dom.currentTemplateMeta.textContent = "等待新模板";
  }

  setNoTemplateState() {
    this.editorState.templateGroup = null;
    this.editorState.templateIndex = null;
    this.templateImage = new Image();
    this.templateMeta = {
      width: 0,
      height: 0,
      groupLabel: "",
      label: "未接入模板",
      indexLabel: ""
    };
    this.canvas.width = 1200;
    this.canvas.height = 1600;
    this.updateTemplateSummary();
    this.setActionAvailability(false);
    this.hideLoading();
    this.hideError();
    this.drawEmptyState();
    this.setStatus("旧模板已清理完成，等待接入新模板。", "muted");
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
    if (key === "width") {
      layer.width = this.clamp(nextValue, layer.minWidth, layer.maxWidth);
      layer.height = Math.round(layer.width / layer.aspectRatio);
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
      const scale = direction > 0 ? 1.04 : 0.96;
      const nextWidth = this.clamp(layer.width * scale, layer.minWidth, layer.maxWidth);
      layer.width = nextWidth;
      layer.height = Math.round(nextWidth / layer.aspectRatio);
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
      layer.x = this.clamp(layer.x, 0, Math.max(0, this.canvas.width - layer.width));
      layer.y = this.clamp(layer.y, 0, Math.max(0, this.canvas.height - layer.height));
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
      this.setStatus("上传失败，请选择图片文件。", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const avatarImage = new Image();
      avatarImage.onload = () => {
        this.editorState.avatar.image = avatarImage;
        this.editorState.avatar.imageSrc = event.target.result;
        this.setStatus("图片已载入，右侧预览已更新。", "success");
        this.draw();
      };
      avatarImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  draw() {
    if (!this.templateImage.complete) {
      this.drawEmptyState();
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
    if (avatar.image) {
      const targetAspectRatio = avatar.width / avatar.height;
      const sourceAspectRatio = avatar.image.width / avatar.image.height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = avatar.image.width;
      let sourceHeight = avatar.image.height;

      // Fill the target area without stretching: preserve aspect ratio and crop excess.
      if (sourceAspectRatio > targetAspectRatio) {
        sourceWidth = avatar.image.height * targetAspectRatio;
        sourceX = (avatar.image.width - sourceWidth) / 2;
      } else {
        sourceHeight = avatar.image.width / targetAspectRatio;
        sourceY = (avatar.image.height - sourceHeight) / 2;
      }

      this.ctx.save();
      if (avatar.shape === "ellipse") {
        this.ctx.beginPath();
        this.ctx.ellipse(
          avatar.x + avatar.width / 2,
          avatar.y + avatar.height / 2,
          avatar.width / 2,
          avatar.height / 2,
          0,
          0,
          Math.PI * 2
        );
        this.ctx.closePath();
        this.ctx.clip();
      }

      this.ctx.drawImage(
        avatar.image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        avatar.x,
        avatar.y,
        avatar.width,
        avatar.height
      );
      this.ctx.restore();
    }

    if (avatar.frameImage) {
      this.ctx.drawImage(avatar.frameImage, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  drawEmptyState() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#0b0f16";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 140, 0, 0.22)";
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([18, 18]);
    this.ctx.strokeRect(90, 90, this.canvas.width - 180, this.canvas.height - 180);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "700 58px Arial";
    this.ctx.fillText("当前没有模板", this.canvas.width / 2, this.canvas.height / 2 - 36);
    this.ctx.fillStyle = "rgba(255,255,255,0.6)";
    this.ctx.font = "400 28px Arial";
    this.ctx.fillText("请先接入新的模板图片和配置", this.canvas.width / 2, this.canvas.height / 2 + 36);
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
    this.ctx.font = `${style.fontWeight ? `${style.fontWeight} ` : ""}${layer.fontSize}px ${style.fontFamily}, serif`;
    this.ctx.textAlign = layer.anchor === "baseline-center" ? "center" : "left";
    this.ctx.textBaseline = "alphabetic";

    if (style.shadow) {
      this.ctx.globalAlpha = 0.28;
      this.ctx.fillStyle = "#000000";
      this.ctx.fillText(displayValue, layer.x, layer.y + Math.max(2, Math.round(layer.fontSize * 0.05)));
    }

    this.ctx.globalAlpha = 1;
    if (style.gradient) {
      const bounds = this.getTextBounds(layerKey);
      this.ctx.fillStyle = this.createTextGradient(bounds, style);
    } else {
      this.ctx.fillStyle = style.fill;
    }
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
      this.setStatus("模板尚未加载完成，暂时无法下载。", "error");
      return;
    }

    const link = document.createElement("a");
    const safeGroupLabel = this.templateMeta.groupLabel.replace(/\s+/g, "_").replace(/[^\w\u4e00-\u9fa5-]/g, "");
    link.download = `POEX证书_${safeGroupLabel}_${this.templateMeta.indexLabel}.png`;
    link.href = this.canvas.toDataURL("image/png");
    link.click();
    this.setStatus("PNG 下载已开始。", "success");
  }

  async copyCertificate() {
    if (!this.templateImage.complete) {
      this.setStatus("模板尚未加载完成，暂时无法复制。", "error");
      return;
    }

    if (!window.ClipboardItem || !navigator.clipboard) {
      this.setStatus("当前浏览器不支持复制图片，请使用下载 PNG。", "error");
      window.alert("当前浏览器不支持复制图片，请使用下载 PNG。");
      return;
    }

    this.canvas.toBlob(async (blob) => {
      if (!blob) {
        this.setStatus("复制失败，请改用下载 PNG。", "error");
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
        this.setStatus("图片已复制到剪贴板。", "success");
      } catch (error) {
        console.error("复制图片失败：", error);
        this.setStatus("复制失败，请改用下载 PNG。", "error");
        window.alert("复制失败，请改用下载 PNG。");
      }
    }, "image/png");
  }

  setActionAvailability(enabled) {
    [this.dom.copyBtn, this.dom.downloadBtn].forEach((button) => {
      if (!button) {
        return;
      }
      button.disabled = !enabled;
    });
  }

  setStatus(message, tone = "muted") {
    if (!this.dom.actionStatus) {
      return;
    }
    this.dom.actionStatus.textContent = message;
    this.dom.actionStatus.dataset.tone = tone;
  }

  flashActionButton(button, text) {
    if (!button) {
      return;
    }

    const previousText = button.textContent;
    button.textContent = text;
    button.classList.add("is-flashing");

    window.setTimeout(() => {
      button.textContent = previousText;
      button.classList.remove("is-flashing");
    }, 1600);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const editor = new PoexCertificateEditor();
  editor.init();
});
