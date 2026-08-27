/* @ds-bundle: {"format":4,"namespace":"CRDGuildDesignSystem_3c68ee","components":[{"name":"Crest","sourcePath":"components/brand/Crest.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"RadioGroup","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/brand/Crest.jsx":"9490c0f06a6d","components/core/Badge.jsx":"f062910289e6","components/core/Button.jsx":"5bc4243703f1","components/core/Card.jsx":"cbc8b2075c4a","components/core/Icon.jsx":"ec16c91d3dd8","components/core/IconButton.jsx":"9c3974a826ba","components/core/Tag.jsx":"8fb0d75270f5","components/feedback/Dialog.jsx":"ecf8b00b74c3","components/feedback/Toast.jsx":"e937027bf287","components/feedback/Tooltip.jsx":"62826f4d8e86","components/forms/Checkbox.jsx":"de2137484076","components/forms/Input.jsx":"37a2905684be","components/forms/Radio.jsx":"8b0a8de5ed91","components/forms/Select.jsx":"3144d89c4709","components/forms/Switch.jsx":"596fc4cd30e8","components/navigation/Tabs.jsx":"73ec71687473","ui_kits/portal/AppShell.jsx":"003199be5ccb","ui_kits/portal/ApplicationsScreen.jsx":"bd9cc44e5256","ui_kits/portal/DashboardScreen.jsx":"82a119ddffe7","ui_kits/portal/EventScreen.jsx":"96876bdd0394","ui_kits/portal/PortalRosterScreen.jsx":"b1d5c2d40787","ui_kits/website/EventsScreen.jsx":"86152db59179","ui_kits/website/ExpectationsScreen.jsx":"726c7f040e5b","ui_kits/website/HomeScreen.jsx":"8ac45a836fe9","ui_kits/website/OfferScreen.jsx":"f89fd72297a3","ui_kits/website/RegisterScreen.jsx":"c84a582253f3","ui_kits/website/SiteChrome.jsx":"192335b7c331"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CRDGuildDesignSystem_3c68ee = window.CRDGuildDesignSystem_3c68ee || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Crest.jsx
try { (() => {
const SRC = {
  emblem: 'guild-emblem.png'
};
function Crest({
  size = 64,
  wordmark = false,
  assetBase = 'assets',
  className = '',
  style
}) {
  const img = /*#__PURE__*/React.createElement("img", {
    src: `${assetBase}/${SRC.emblem}`,
    alt: "Casual Raid Days guild crest",
    width: size,
    height: size,
    style: {
      display: 'block',
      width: size,
      height: 'auto',
      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.55))'
    }
  });
  if (!wordmark) return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: style
  }, img);
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: Math.round(size * 0.22),
      ...style
    }
  }, img, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 900,
      fontSize: Math.round(size * 0.46),
      letterSpacing: '0.1em',
      color: 'var(--text-gold)',
      lineHeight: 1
    }
  }, "CRD"));
}
Object.assign(__ds_scope, { Crest });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Crest.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    color: 'var(--text-muted)',
    border: 'var(--border-iron)',
    bg: 'var(--surface-raised)'
  },
  gold: {
    color: 'var(--gold-300)',
    border: 'rgba(212,179,88,.45)',
    bg: 'rgba(192,144,47,.12)'
  },
  success: {
    color: '#8fc47c',
    border: 'rgba(95,158,74,.5)',
    bg: 'rgba(95,158,74,.14)'
  },
  info: {
    color: '#7fb0d8',
    border: 'rgba(63,127,181,.5)',
    bg: 'rgba(63,127,181,.14)'
  },
  warning: {
    color: '#e0885a',
    border: 'rgba(194,91,40,.5)',
    bg: 'rgba(194,91,40,.14)'
  },
  danger: {
    color: '#d67373',
    border: 'rgba(168,50,50,.55)',
    bg: 'rgba(168,50,50,.16)'
  },
  prestige: {
    color: '#b28fd0',
    border: 'rgba(138,95,176,.5)',
    bg: 'rgba(138,95,176,.16)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `crd-badge ${className}`,
    style: {
      color: t.color,
      borderColor: t.border,
      background: t.bg,
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: "crd-badge__dot"
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  children,
  title,
  eyebrow,
  action,
  crest = false,
  interactive = false,
  padded,
  className = '',
  ...rest
}) {
  const hasHead = title || eyebrow || action;
  const pad = padded ?? !hasHead;
  const cls = `crd-card${crest ? ' crd-card--crest' : ''}${interactive ? ' crd-card--interactive' : ''}${pad ? ' crd-card--pad' : ''} ${className}`;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), hasHead && /*#__PURE__*/React.createElement("div", {
    className: "crd-card__head"
  }, /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, eyebrow), title && /*#__PURE__*/React.createElement("div", {
    className: "crd-card__title"
  }, title)), action), hasHead ? /*#__PURE__*/React.createElement("div", {
    className: "crd-card__body"
  }, children) : children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CDN = 'https://unpkg.com/lucide-static@0.539.0/icons/';
function Icon({
  name,
  size = 16,
  color,
  style,
  className = '',
  title,
  ...rest
}) {
  const url = `url("${CDN}${name}.svg")`;
  return /*#__PURE__*/React.createElement("span", _extends({
    role: title ? 'img' : 'presentation',
    "aria-label": title,
    className: `crd-icon ${className}`,
    style: {
      width: size,
      height: size,
      color,
      WebkitMaskImage: url,
      maskImage: url,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  block = false,
  disabled = false,
  href,
  className = '',
  ...rest
}) {
  const cls = `crd-btn crd-btn--${variant} crd-btn--${size}${block ? ' crd-btn--block' : ''} ${className}`;
  const glyph = size === 'lg' ? 16 : 14;
  const inner = /*#__PURE__*/React.createElement(React.Fragment, null, iconLeft && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: glyph
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: glyph
  }));
  if (href) return /*#__PURE__*/React.createElement("a", _extends({
    className: cls,
    href: href,
    "aria-disabled": disabled || undefined
  }, rest), inner);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    disabled: disabled
  }, rest), inner);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  size = 'md',
  framed = false,
  disabled = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    className: `crd-iconbtn crd-iconbtn--${size}${framed ? ' crd-iconbtn--framed' : ''} ${className}`
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 14 : 16
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  children,
  icon,
  selected = false,
  onClick,
  onRemove,
  className = '',
  ...rest
}) {
  const cls = `crd-tag${selected ? ' crd-tag--selected' : ''}${onClick ? ' crd-tag--button' : ''} ${className}`;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    onClick: onClick,
    role: onClick ? 'button' : undefined,
    tabIndex: onClick ? 0 : undefined
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 13
  }), children, onRemove && /*#__PURE__*/React.createElement("span", {
    className: "crd-tag__remove",
    role: "button",
    "aria-label": "Remove",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 12
  })));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open = true,
  title,
  eyebrow,
  children,
  footer,
  onClose,
  width = 480,
  className = ''
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "crd-scrim",
    role: "presentation",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: `crd-dialog ${className}`,
    role: "dialog",
    "aria-modal": "true",
    style: {
      maxWidth: width
    },
    onClick: e => e.stopPropagation()
  }, (title || onClose) && /*#__PURE__*/React.createElement("div", {
    className: "crd-dialog__head"
  }, /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    className: "crd-card__title"
  }, title)), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "Close",
    size: "sm",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    className: "crd-dialog__body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "crd-dialog__foot"
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const GLYPH = {
  success: 'check',
  danger: 'triangle-alert',
  info: 'info',
  neutral: 'bell'
};
const HUE = {
  success: 'var(--status-success)',
  danger: 'var(--status-danger)',
  info: 'var(--status-info)',
  neutral: 'var(--text-gold)'
};
function Toast({
  title,
  message,
  tone = 'neutral',
  onDismiss,
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `crd-toast crd-toast--${tone} ${className}`,
    role: "status"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: GLYPH[tone] || GLYPH.neutral,
    size: 16,
    style: {
      color: HUE[tone],
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "crd-toast__title"
  }, title), message && /*#__PURE__*/React.createElement("div", {
    className: "crd-toast__msg"
  }, message)), onDismiss && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "Dismiss",
    size: "sm",
    onClick: onDismiss
  }));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  placement = 'top',
  children,
  className = ''
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: `crd-tip-anchor ${className}`,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false)
  }, children, open && /*#__PURE__*/React.createElement("span", {
    className: `crd-tip crd-tip--${placement}`,
    role: "tooltip"
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  label,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  className = '',
  ...rest
}) {
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `crd-choice ${className}`,
    "data-disabled": disabled,
    role: "checkbox",
    "aria-checked": !!on,
    tabIndex: disabled ? -1 : 0,
    onClick: toggle,
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "crd-choice__box crd-choice__box--check",
    "data-checked": !!on
  }, on && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13
  })), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  hint,
  error,
  icon,
  id,
  multiline = false,
  rows = 3,
  className = '',
  ...rest
}) {
  const fieldId = id || `crd-${Math.random().toString(36).slice(2, 8)}`;
  const control = multiline ? /*#__PURE__*/React.createElement("textarea", _extends({
    id: fieldId,
    rows: rows,
    className: `crd-textarea${error ? ' crd-input--invalid' : ''}`
  }, rest)) : /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    className: `crd-input${error ? ' crd-input--invalid' : ''}`
  }, rest));
  return /*#__PURE__*/React.createElement("div", {
    className: `crd-field ${className}`
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "crd-label",
    htmlFor: fieldId
  }, label), icon && !multiline ? /*#__PURE__*/React.createElement("span", {
    className: "crd-input-wrap crd-input-wrap--icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  }), control) : control, (error || hint) && /*#__PURE__*/React.createElement("span", {
    className: `crd-hint${error ? ' crd-hint--error' : ''}`
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Radio({
  label,
  checked = false,
  disabled = false,
  onChange,
  name,
  value,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `crd-choice ${className}`,
    "data-disabled": disabled,
    role: "radio",
    "aria-checked": checked,
    "data-name": name,
    "data-value": value,
    tabIndex: disabled ? -1 : 0,
    onClick: () => !disabled && onChange && onChange(value),
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        !disabled && onChange && onChange(value);
      }
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "crd-choice__box crd-choice__box--radio",
    "data-checked": checked
  }), label);
}
function RadioGroup({
  label,
  options = [],
  value,
  onChange,
  row = false,
  name,
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `crd-field ${className}`
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "crd-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: row ? 'row' : 'column',
      gap: row ? 'var(--space-6)' : 'var(--space-1)',
      flexWrap: 'wrap'
    }
  }, options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement(Radio, {
      key: opt.value,
      name: name,
      value: opt.value,
      label: opt.label,
      checked: value === opt.value,
      onChange: onChange
    });
  })));
}
Object.assign(__ds_scope, { Radio, RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  hint,
  options = [],
  id,
  className = '',
  children,
  ...rest
}) {
  const fieldId = id || `crd-${Math.random().toString(36).slice(2, 8)}`;
  return /*#__PURE__*/React.createElement("div", {
    className: `crd-field ${className}`
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "crd-label",
    htmlFor: fieldId
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "crd-select-wrap"
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fieldId,
    className: "crd-select"
  }, rest), children || options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 15
  })), hint && /*#__PURE__*/React.createElement("span", {
    className: "crd-hint"
  }, hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  label,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  className = '',
  ...rest
}) {
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `crd-switch ${className}`,
    "data-disabled": disabled,
    role: "switch",
    "aria-checked": !!on,
    tabIndex: disabled ? -1 : 0,
    onClick: toggle,
    onKeyDown: e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "crd-switch__track",
    "data-checked": !!on
  }, /*#__PURE__*/React.createElement("span", {
    className: "crd-switch__knob"
  })), label && /*#__PURE__*/React.createElement("span", {
    className: "crd-switch__label"
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tabs({
  tabs = [],
  value,
  onChange,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `crd-tabs ${className}`,
    role: "tablist"
  }, rest), tabs.map(t => {
    const tab = typeof t === 'string' ? {
      value: t,
      label: t
    } : t;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.value,
      type: "button",
      role: "tab",
      className: "crd-tab",
      "aria-selected": value === tab.value,
      onClick: () => onChange && onChange(tab.value)
    }, tab.label, tab.count != null && /*#__PURE__*/React.createElement("span", {
      className: "crd-tab__count"
    }, tab.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/AppShell.jsx
try { (() => {
const {
  Crest,
  Icon,
  IconButton,
  Badge,
  Button,
  Tooltip
} = window.CRDGuildDesignSystem_3c68ee;
const RAIL = [{
  key: 'dashboard',
  label: 'Members lounge',
  icon: 'home'
}, {
  key: 'events',
  label: 'Guild events',
  icon: 'calendar-days',
  count: 3
}, {
  key: 'roster',
  label: 'Roster',
  icon: 'users'
}, {
  key: 'apps',
  label: 'Registrations',
  icon: 'scroll-text',
  count: 2
}];
function AppShell({
  route,
  go,
  children,
  title,
  eyebrow,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '244px 1fr',
      minHeight: '100vh',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      borderRight: '1px solid var(--border-hairline)',
      background: 'var(--surface-sunken)',
      padding: 'var(--space-5) var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-8)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(Crest, {
    size: 34,
    wordmark: true,
    assetBase: "../../assets"
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, RAIL.map(r => {
    const on = route === r.key;
    return /*#__PURE__*/React.createElement("button", {
      key: r.key,
      type: "button",
      onClick: () => go(r.key),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        width: '100%',
        background: on ? 'var(--action-secondary)' : 'transparent',
        border: '1px solid ' + (on ? 'var(--border-soft)' : 'transparent'),
        borderRadius: 'var(--radius-sm)',
        padding: '9px var(--space-3)',
        cursor: 'pointer',
        color: on ? 'var(--text-gold)' : 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-body-m)',
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: r.icon,
      size: 16
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, r.label), r.count && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--text-faint)'
      }
    }, r.count));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      borderTop: '1px solid var(--border-hairline)',
      paddingTop: 'var(--space-4)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--grad-gold)',
      color: 'var(--text-on-gold)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 13
    }
  }, "P"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-strong)'
    }
  }, "Perseffonee"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      fontFamily: 'var(--font-mono)'
    }
  }, "Guild Master")), /*#__PURE__*/React.createElement(IconButton, {
    icon: "settings",
    label: "Settings",
    size: "sm"
  }))), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-5) var(--space-8)',
      borderBottom: '1px solid var(--border-hairline)',
      background: 'rgba(18,16,12,.92)',
      backdropFilter: 'var(--blur-panel)'
    }
  }, /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, eyebrow), /*#__PURE__*/React.createElement("h3", {
    style: {
      marginTop: eyebrow ? 4 : 0
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)'
    }
  }, actions, /*#__PURE__*/React.createElement(Tooltip, {
    label: "Guild notifications"
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "bell",
    label: "Notifications",
    framed: true
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-8)'
    }
  }, children)));
}
Object.assign(window, {
  AppShell,
  RAIL
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/ApplicationsScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Tag,
  Icon,
  Dialog,
  Input,
  Toast
} = window.CRDGuildDesignSystem_3c68ee;
const APPS = [{
  name: 'Larkspine',
  cls: 'Priest',
  role: 'Healer',
  when: '2 days ago',
  ilvl: 481,
  tz: 'GMT / UK',
  nights: ['Heroic Progression (Sat)', 'LFR & BFFs (Wed)'],
  tags: ['Mythic keys', 'Legacy raids', 'Brunch'],
  why: 'I raided hardcore for six years and burned out badly. I want somewhere I can heal a night or two and actually enjoy it. "Casual, but not without commitment" is exactly what I was looking for.'
}, {
  name: 'Mossfang',
  cls: 'Hunter',
  role: 'Ranged',
  when: '5 days ago',
  ilvl: 476,
  tz: 'CET',
  nights: ['Normal Alt Raid (Fri)'],
  tags: ['Delves', 'PvP', 'Contests & silliness'],
  why: 'Friend of Odasa. Mostly here for Shortie’s Shenanigans and the keys, happy to fill in on the alt raid when you are short.'
}];
function ApplicationsScreen({
  onDecision
}) {
  const [open, setOpen] = React.useState(null);
  const [note, setNote] = React.useState('');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: 'var(--space-6)',
      alignItems: 'start'
    }
  }, APPS.map(a => /*#__PURE__*/React.createElement(Card, {
    key: a.name,
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-soft)',
      color: 'var(--text-gold)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700
    }
  }, a.name[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-strong)',
      fontFamily: 'var(--font-display)',
      letterSpacing: 'var(--tracking-display)'
    }
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, a.cls, " \xB7 ", a.role, " \xB7 ilvl ", a.ilvl, " \xB7 ", a.tz)), /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    style: {
      marginLeft: 'auto'
    }
  }, "New \xB7 ", a.when)), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-5)',
      marginBottom: 0,
      color: 'var(--text-body)'
    }
  }, a.why), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-2)',
      flexWrap: 'wrap',
      marginTop: 'var(--space-5)'
    }
  }, a.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      marginTop: 'var(--space-4)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar-days",
    size: 13,
    style: {
      color: 'var(--text-gold)'
    }
  }), a.nights.join(' · '))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      padding: 'var(--space-4) var(--space-6)',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--grad-header)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    iconLeft: "check",
    onClick: () => setOpen(a)
  }, "Invite as Initiate"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "Ask a question"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    style: {
      marginLeft: 'auto'
    }
  }, "Not for us"))))), /*#__PURE__*/React.createElement(Dialog, {
    open: !!open,
    eyebrow: "New recruit",
    title: open ? `Promote ${open.name} to Initiate?` : '',
    onClose: () => setOpen(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setOpen(null)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        onDecision(`${open.name} promoted to Initiate`);
        setOpen(null);
      }
    }, "Send invite"))
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 0
    }
  }, "All recruits are promoted to \"Initiate\": very limited bank access and no guild repairs until they advance. Discord link is provided in-game."), /*#__PURE__*/React.createElement(Input, {
    label: "Note to them",
    multiline: true,
    rows: 3,
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "Glad you registered \u2014 please read our guild expectations, and see you Saturday!"
  })));
}
Object.assign(window, {
  ApplicationsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/ApplicationsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/DashboardScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Icon,
  Tag,
  Tooltip,
  Switch
} = window.CRDGuildDesignSystem_3c68ee;
const UPCOMING = [{
  id: 'wed',
  title: 'LFR & BFFs',
  when: 'Wednesday',
  signed: 14,
  tentative: 6,
  tone: 'success',
  kind: 'LFR'
}, {
  id: 'fri',
  title: 'Normal Alt Raid',
  when: 'Friday',
  signed: 11,
  tentative: 4,
  tone: 'info',
  kind: 'Alt raid'
}, {
  id: 'sat',
  title: 'The Venomous Abyss, Heroic',
  when: 'Saturday',
  signed: 18,
  tentative: 5,
  tone: 'gold',
  kind: 'Progression'
}];
const FEED = [{
  who: 'Perseffonee',
  rank: 'Guild Master',
  text: 'Saturday is Heroic progression — we are 3/8 in the Abyss. Be polite, punctual and prepared, and we will get the fourth.',
  when: '2h'
}, {
  who: 'Hotchick',
  rank: 'Officer Banker',
  text: 'Bank restocked with mats for feasts and cauldrons. Brunch is farming and fishing this weekend — come chat.',
  when: 'Yesterday'
}, {
  who: 'Shortie',
  rank: 'Officer',
  text: 'Before the end of the month, message me to cast your vote for Guildie of the Month!',
  when: 'Yesterday'
}];
function DashboardScreen({
  go,
  onSignup
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.5fr .8fr',
      gap: 'var(--space-6)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    crest: true,
    eyebrow: "Next up \xB7 Saturday, Heroic Progression",
    title: "The Venomous Abyss",
    action: /*#__PURE__*/React.createElement(Badge, {
      tone: "gold"
    }, "3/8 H")
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      marginBottom: 'var(--space-5)',
      color: 'var(--text-body)'
    }
  }, "Hosted by Officer Perseffonee. Feasts and cauldrons are covered by the bank \u2014 thank Hotchick. Be polite, punctual and prepared."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    iconLeft: "check",
    onClick: () => onSignup('wed')
  }, "Sign up"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Tentative"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Can\u2019t make it"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-label)',
      color: 'var(--text-muted)'
    }
  }, "14 signed \xB7 6 tentative"))), /*#__PURE__*/React.createElement(Card, {
    eyebrow: "Guild board",
    title: "What Officers Are Saying",
    padded: false
  }, FEED.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: f.who,
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      padding: 'var(--space-5) var(--space-6)',
      borderTop: i ? '1px solid var(--border-hairline)' : 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 32,
      height: 32,
      flex: 'none',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-soft)',
      color: 'var(--text-gold)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 13
    }
  }, f.who[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-strong)'
    }
  }, f.who), /*#__PURE__*/React.createElement(Badge, {
    tone: f.rank === 'Raider' ? 'info' : 'gold'
  }, f.rank), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, f.when)), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-body)',
      marginTop: 4
    }
  }, f.text)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    eyebrow: "This week",
    title: "Schedule",
    padded: false
  }, UPCOMING.map((u, i) => /*#__PURE__*/React.createElement("div", {
    key: u.id,
    onClick: () => go('events'),
    style: {
      padding: 'var(--space-4) var(--space-6)',
      borderTop: i ? '1px solid var(--border-hairline)' : 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 'var(--space-3)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-strong)',
      fontSize: 'var(--text-body-s)'
    }
  }, u.title), /*#__PURE__*/React.createElement(Badge, {
    tone: u.tone
  }, u.kind)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      marginTop: 4
    }
  }, u.when, " \xB7 ", u.signed, " signed")))), /*#__PURE__*/React.createElement(Card, {
    eyebrow: "You",
    title: "Your standing"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, [['Attendance, last 8', '88%', 'success'], ['Item level', '486', 'neutral'], ['Rank', 'Veteran Member', 'neutral']].map(([k, v, t]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-body-s)',
      color: t === 'success' ? 'var(--status-success)' : 'var(--text-body)'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-5)',
      paddingTop: 'var(--space-4)',
      borderTop: '1px solid var(--border-hairline)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Remind me an hour before",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Show my alts on the roster"
  }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "heart-handshake",
    size: 18,
    style: {
      color: 'var(--text-gold)',
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Every member, all in different capacities, participates in the health and progression of the guild.")))));
}
Object.assign(window, {
  DashboardScreen,
  UPCOMING
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/EventScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Tabs,
  Tag,
  Icon,
  Tooltip,
  Input,
  Select,
  Dialog,
  RadioGroup,
  Checkbox
} = window.CRDGuildDesignSystem_3c68ee;
const SIGNUPS = {
  Tank: [['Brambleaxe', 'in'], ['Thornebeard', 'tentative']],
  Healer: [['Sylvestria', 'in'], ['Grumblehoof', 'in'], ['Rowanmoss', 'tentative']],
  Melee: [['Duskmantle', 'in'], ['Kelvarr', 'in'], ['Mossfang', 'out']],
  Ranged: [['Ashvane', 'in'], ['Emberlyn', 'in'], ['Nettlewick', 'in'], ['Larkspine', 'tentative']]
};
const TONE = {
  in: 'success',
  tentative: 'warning',
  out: 'danger'
};
const WORD = {
  in: 'In',
  tentative: 'Tentative',
  out: 'Out'
};
function EventScreen({
  signedUp,
  onSignup
}) {
  const [tab, setTab] = React.useState('signups');
  const [dialog, setDialog] = React.useState(false);
  const [role, setRole] = React.useState('Healer');
  const counts = Object.values(SIGNUPS).flat().reduce((a, [, s]) => {
    a[s] = (a[s] || 0) + 1;
    return a;
  }, {});
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr .8fr',
      gap: 'var(--space-6)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    crest: true,
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "gold"
  }, "Progression"), /*#__PURE__*/React.createElement(Badge, {
    tone: "prestige"
  }, "Heroic 3/8"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-label)',
      color: 'var(--text-muted)'
    }
  }, "Saturday \xB7 Hosted by Officer Perseffonee")), /*#__PURE__*/React.createElement("h2", {
    style: {
      marginTop: 'var(--space-4)'
    }
  }, "The Venomous Abyss"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 0,
      color: 'var(--text-body)',
      maxWidth: 560
    }
  }, "Heroic progression, every Saturday. Feasts and cauldrons come from the bank \u2014 be polite, punctual and prepared. If you are on the bench you are still contributing to the health and progression of the guild.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      padding: 'var(--space-4) var(--space-6)',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--grad-header)'
    }
  }, signedUp ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "You\u2019re in as ", role), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => onSignup(false)
  }, "Change")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    iconLeft: "check",
    onClick: () => setDialog(true)
  }, "Sign up"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Tentative"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Can\u2019t make it")), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-label)',
      color: 'var(--text-muted)'
    }
  }, counts.in, " in \xB7 ", counts.tentative, " tentative \xB7 ", counts.out || 0, " out"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'signups',
      label: 'Signups',
      count: Object.values(SIGNUPS).flat().length
    }, {
      value: 'notes',
      label: 'Notes'
    }, {
      value: 'loot',
      label: 'Loot rules'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 'var(--space-6)'
    }
  }, tab === 'signups' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: 'var(--space-5)'
    }
  }, Object.entries(SIGNUPS).map(([group, list]) => /*#__PURE__*/React.createElement(Card, {
    key: group,
    title: group,
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--text-faint)'
      }
    }, list.length),
    padded: false
  }, list.map(([n, s], i) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'var(--space-3) var(--space-6)',
      borderTop: i ? '1px solid var(--border-hairline)' : 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-body)'
    }
  }, n), /*#__PURE__*/React.createElement(Badge, {
    tone: TONE[s]
  }, WORD[s])))))), tab === 'notes' && /*#__PURE__*/React.createElement(Card, {
    className: "crd-parchment",
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-soft)'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--text-strong)'
    }
  }, "Tactics reminder"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 0,
      color: 'var(--text-body)'
    }
  }, "Soak in pairs; healers rotate cooldowns on the third set. If we are still learning late we call it and pick it back up next Saturday.")), tab === 'loot' && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, ['Personal loot, trade freely inside the raid.', 'Tier before offspec, always.', 'Read the guild expectations before signing up.', 'If two people need it, the one who has attended less gets it.'].map(r => /*#__PURE__*/React.createElement("div", {
    key: r,
    style: {
      display: 'flex',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    style: {
      color: 'var(--status-success)',
      marginTop: 3
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)'
    }
  }, r)))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    eyebrow: "Composition",
    title: "Where we stand"
  }, Object.entries(SIGNUPS).map(([g, list]) => {
    const need = {
      Tank: 2,
      Healer: 4,
      Melee: 6,
      Ranged: 8
    }[g];
    const have = list.filter(([, s]) => s === 'in').length;
    return /*#__PURE__*/React.createElement("div", {
      key: g,
      style: {
        marginBottom: 'var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 'var(--text-body-s)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-muted)'
      }
    }, g), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        color: have >= need ? 'var(--status-success)' : 'var(--text-gold)'
      }
    }, have, "/", need)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        background: 'var(--surface-sunken)',
        boxShadow: 'var(--inset-well)',
        borderRadius: 'var(--radius-pill)',
        marginTop: 6,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${Math.min(100, have / need * 100)}%`,
        height: '100%',
        background: have >= need ? 'var(--status-success)' : 'var(--grad-gold)'
      }
    })));
  })), /*#__PURE__*/React.createElement(Card, {
    eyebrow: "Officer tools",
    title: "Manage night"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    iconLeft: "bell"
  }, "Ping Discord"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    iconLeft: "users"
  }, "Build the group"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    block: true
  }, "Cancel this night"))))), /*#__PURE__*/React.createElement(Dialog, {
    open: dialog,
    eyebrow: "Saturday \xB7 Heroic Progression",
    title: "Sign up for this raid",
    onClose: () => setDialog(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setDialog(false)
    }, "Not yet"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        setDialog(false);
        onSignup(true);
      }
    }, "Sign me up"))
  }, /*#__PURE__*/React.createElement(RadioGroup, {
    label: "Signing up as",
    row: true,
    value: role,
    onChange: setRole,
    options: ['Tank', 'Healer', 'Melee', 'Ranged']
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Anything we should know?",
    multiline: true,
    rows: 2,
    placeholder: "Might be 10 minutes late"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    label: "Remind me an hour before",
    defaultChecked: true
  }))));
}
Object.assign(window, {
  EventScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/EventScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/PortalRosterScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Tabs,
  Tag,
  Icon,
  Input,
  Tooltip,
  IconButton
} = window.CRDGuildDesignSystem_3c68ee;
const ROWS = [{
  name: 'Perseffonee',
  cls: 'Priest',
  rank: 'Guild Master',
  role: 'Healer',
  ilvl: 489,
  att: 92,
  on: true,
  tone: 'gold'
}, {
  name: 'Vadailla',
  cls: 'Druid',
  rank: 'Chief Officer',
  role: 'Tank',
  ilvl: 487,
  att: 90,
  on: true,
  tone: 'gold'
}, {
  name: 'Hotchick',
  cls: 'Shaman',
  rank: 'Officer Banker',
  role: 'Healer',
  ilvl: 483,
  att: 84,
  on: false,
  tone: 'gold'
}, {
  name: 'Harima',
  cls: 'Mage',
  rank: 'Officer',
  role: 'Ranged',
  ilvl: 486,
  att: 88,
  on: true,
  tone: 'gold'
}, {
  name: 'Shortie',
  cls: 'Rogue',
  rank: 'Officer',
  role: 'Melee',
  ilvl: 481,
  att: 79,
  on: true,
  tone: 'gold'
}, {
  name: 'Zalanto',
  cls: 'Hunter',
  rank: 'Officer',
  role: 'Ranged',
  ilvl: 484,
  att: 76,
  on: false,
  tone: 'gold'
}, {
  name: 'Odasa',
  cls: 'Warrior',
  rank: 'Veteran Member',
  role: 'Melee',
  ilvl: 480,
  att: 81,
  on: true,
  tone: 'success'
}, {
  name: 'Addy',
  cls: 'Monk',
  rank: 'Veteran Member',
  role: 'Melee',
  ilvl: 472,
  att: 66,
  on: true,
  tone: 'success'
}, {
  name: 'Melfinnaa',
  cls: 'Paladin',
  rank: 'Member',
  role: '—',
  ilvl: 455,
  att: 0,
  on: true,
  tone: 'info'
}, {
  name: 'Larkspine',
  cls: 'Priest',
  rank: 'Initiate',
  role: 'Healer',
  ilvl: 481,
  att: 100,
  on: true,
  tone: 'warning'
}, {
  name: 'Celyndrashad',
  cls: 'Warlock',
  rank: 'Emeritus Officer',
  role: 'Ranged',
  ilvl: 440,
  att: 0,
  on: false,
  tone: 'prestige'
}];
const COLS = '1.4fr .9fr .7fr .6fr .8fr 40px';
function PortalRosterScreen() {
  const [q, setQ] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const rows = ROWS.filter(r => tab === 'all' ? true : tab === 'raiders' ? ['Chief Officer', 'Officer', 'Officer Banker', 'Guild Master', 'Veteran Member'].includes(r.rank) : tab === 'trials' ? r.rank === 'Initiate' : r.on).filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'all',
      label: 'Everyone',
      count: ROWS.length
    }, {
      value: 'raiders',
      label: 'Officers & veterans',
      count: 8
    }, {
      value: 'trials',
      label: 'Initiates',
      count: 1
    }, {
      value: 'online',
      label: 'Online',
      count: ROWS.filter(r => r.on).length
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "search",
    placeholder: "Find a character",
    value: q,
    onChange: e => setQ(e.target.value)
  }))), /*#__PURE__*/React.createElement(Card, {
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: COLS,
      gap: 'var(--space-4)',
      padding: 'var(--space-3) var(--space-6)',
      background: 'var(--grad-header)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, ['Character', 'Rank', 'Role', 'ilvl', 'Attendance', ''].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "crd-label"
  }, h))), rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: r.name,
    style: {
      display: 'grid',
      gridTemplateColumns: COLS,
      gap: 'var(--space-4)',
      alignItems: 'center',
      padding: 'var(--space-3) var(--space-6)',
      borderTop: i ? '1px solid var(--border-hairline)' : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      flex: 'none',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-soft)',
      color: 'var(--text-gold)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 12
    }
  }, r.name[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-strong)',
      fontSize: 'var(--text-body-s)'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, r.cls, r.on ? ' · online' : ''))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r.tone
  }, r.rank)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, r.role), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-body-s)'
    }
  }, r.ilvl), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 6,
      background: 'var(--surface-sunken)',
      boxShadow: 'var(--inset-well)',
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${r.att}%`,
      height: '100%',
      background: r.att >= 80 ? 'var(--status-success)' : r.att >= 60 ? 'var(--grad-gold)' : 'var(--status-warning)'
    }
  })), /*#__PURE__*/React.createElement(Tooltip, {
    label: "Last 8 scheduled nights"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-muted)'
    }
  }, r.att ? r.att + '%' : '—'))), /*#__PURE__*/React.createElement(IconButton, {
    icon: "ellipsis",
    label: `Manage ${r.name}`,
    size: "sm"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center',
      color: 'var(--text-faint)',
      fontSize: 'var(--text-body-s)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 14
  }), " Rank is awarded to the PERSON not the toon \u2014 all of a member's characters carry the same rank."));
}
Object.assign(window, {
  PortalRosterScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/PortalRosterScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/EventsScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Icon,
  Tag
} = window.CRDGuildDesignSystem_3c68ee;
const EVENTS = [{
  img: 'calendar',
  title: 'Event Calendar',
  host: '',
  note: 'Every scheduled raid, key, delve, farm and contest in one place.'
}, {
  img: 'contests',
  title: "CRD's Contests and Silliness",
  host: '',
  note: 'Guild-wide silliness with prizes.'
}, {
  img: 'legacy',
  title: "CRD's Legacy Raids",
  host: '',
  note: 'Nostalgic raids, old-school and open to alts.'
}, {
  img: 'keysSunday',
  title: '"Sunday Funday Keys"',
  host: 'Officer Harima',
  note: 'Mythic keystones, relaxed pace.'
}, {
  img: 'keysMonday',
  title: '"Monday Mayhem Keys"',
  host: 'Officer Harima',
  note: 'Mythic keystones, a little louder.'
}, {
  img: 'shenanigans',
  title: 'Shenanigans',
  host: 'Officer Shortie',
  note: 'Delves and whatever else Shortie invents.'
}, {
  img: 'brunch',
  title: '"Brunch" — Farming and Fishing',
  host: 'Officer Hotchick',
  note: 'Mats for feasts and cauldrons; come chat.'
}, {
  img: 'midnight',
  title: 'Normal Alt Raid',
  host: 'Officer Vadailla',
  note: 'Every Friday. Bring the alt you never gear.'
}, {
  img: 'midnight',
  title: 'LFR & BFFs',
  host: 'Officer Quixxie',
  note: 'Every Wednesday. Guild LFR, no pressure.'
}, {
  img: 'midnight',
  title: 'Heroic Progression',
  host: 'Officer Perseffonee',
  note: 'Every Saturday. The Venomous Abyss, 3/8.'
}, {
  img: 'advKeys',
  title: '"Adventurous Keys"',
  host: 'Officer Zalanto',
  note: 'Keys with a sense of adventure.'
}];
function EventsScreen({
  go
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Section, {
    title: "Guild Events",
    lede: "We schedule several events to accomplish our weekly guild challenges, appeal to a variety of interests and to accommodate the needs of our guild and its members."
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "scroll-text",
    size: 18,
    style: {
      color: 'var(--text-gold)',
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)'
    }
  }, "Before signing-up for any event, please read our", ' ', /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('expectations');
    }
  }, "guild expectations"), ' ', "to familiarize yourself with our policies, expectations, loot rules and etiquette."))), /*#__PURE__*/React.createElement(Section, {
    title: "Our Events"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(258px,1fr))',
      gap: 'var(--space-5)'
    }
  }, EVENTS.map(e => /*#__PURE__*/React.createElement(Card, {
    key: e.title + e.host,
    padded: false,
    interactive: true
  }, /*#__PURE__*/React.createElement("img", {
    src: IMG[e.img],
    alt: "",
    style: {
      width: '100%',
      height: 126,
      objectFit: 'cover',
      display: 'block',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--space-5)'
    }
  }, e.host && /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, e.host), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      letterSpacing: 'var(--tracking-display)',
      color: 'var(--text-strong)',
      fontSize: 'var(--text-title-s)',
      marginTop: e.host ? 6 : 0
    }
  }, e.title), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6,
      marginBottom: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, e.note)))))));
}
Object.assign(window, {
  EventsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/EventsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/ExpectationsScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Icon,
  Tabs
} = window.CRDGuildDesignSystem_3c68ee;
const EXPECTATIONS = ['be respectful and supportive of others', 'be a positive contributor to the progression and health of our guild', 'no swearing and display appropriate behaviour', 'refrain from making vulgar, derogatory, religious or political comments', 'be polite, punctual and prepared for guild events'];
const RANKS = [{
  rank: 'Initiate',
  tone: 'neutral',
  desc: 'A period of probation.',
  perks: ['very limited access to the guild bank', 'is not entitled to guild repairs']
}, {
  rank: 'Member',
  tone: 'info',
  desc: 'A member who plays infrequently or is beginning to advance in rank because he/she is respecting guild expectations, and displaying mature, supportive and contributing behavior.',
  perks: ['limited access to the guild bank', '200 gold guild repair allowance']
}, {
  rank: 'Veteran Member',
  tone: 'success',
  desc: 'A loyal, reliable and helpful member who regularly plays, contributes to the guild bank and supports his/her fellow guild members.',
  perks: ['access to the guild bank', '600 gold guild repair allowance']
}, {
  rank: 'Emeritus Officer',
  tone: 'prestige',
  desc: 'A former Officer who plays occasionally or is retired, but remains an honorary Officer to recognize his/her important and appreciated contribution to the guild.',
  perks: ['access to the guild bank', '400 gold guild repair allowance']
}, {
  rank: 'Officer Banker',
  tone: 'gold',
  desc: 'Hotchick is our guild auctioneer and venture capitalist. From recipe mats to crafted items, she auctions these items to earn gold for the guild bank, keeps the bank organized, and ensures we have enough mats for feasts and cauldrons during raid progression.',
  perks: ['full access to the guild bank', '1000 gold guild repair allowance', 'decision-making privileges']
}, {
  rank: 'Chief Officer & Officers',
  tone: 'gold',
  desc: 'A mature, trustworthy, loyal, reliable, helpful and contributing member. Officers attend weekly meetings, represent and enforce guild expectations, promote conflict resolution, and address guild interest and concerns. Only Officers may schedule and/or supervise raids and events.',
  perks: ['full access to the guild bank', '1000 gold guild repair allowance', 'decision-making privileges']
}];
function ExpectationsScreen({
  go
}) {
  const [tab, setTab] = React.useState('general');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Section, {
    title: "General Guild Expectations",
    lede: "We reserve the right to amend the governing policies of CRD as necessary to promote a friendly, mature, and supportive community for all of our members."
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      value: 'general',
      label: 'Expectations'
    }, {
      value: 'removal',
      label: 'Removal of Members'
    }, {
      value: 'ranks',
      label: 'Guild Ranking',
      count: RANKS.length
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 'var(--space-6)'
    }
  }, tab === 'general' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr .8fr',
      gap: 'var(--space-8)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "crd-parchment",
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-10)',
      boxShadow: 'var(--shadow-3)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: 'var(--text-strong)'
    }
  }, "Expectations"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      color: 'var(--text-body)',
      fontSize: 'var(--text-body-l)'
    }
  }, "You are a representative of Casual Raid Days. Therefore, all guild members are expected to:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-5)'
    }
  }, EXPECTATIONS.map(e => /*#__PURE__*/React.createElement("div", {
    key: e,
    style: {
      display: 'flex',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    style: {
      color: 'var(--bronze-500)',
      marginTop: 4
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      fontSize: 'var(--text-body-l)'
    }
  }, e))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    crest: true
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-display-s)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, "Rank is awarded to the PERSON not the toon."), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-4)',
      marginBottom: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "All your characters are granted the same rank. You do not have to be a \"raider\" to be an Officer.")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "Next Page"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Raiding expectations and loot rules live on their own page."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    iconRight: "chevron-right"
  }, "Raiding Expectations & Loot Rules")))), tab === 'removal' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr .8fr',
      gap: 'var(--space-8)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-body)'
    }
  }, "We will not tolerate abusive, profane or vulgar comments; bullying, racial and religious slurs, or any other behavior that competes with our efforts to foster a welcoming and supportive community. Please follow these expectations; otherwise, you will be issued a warning. If you continue to display inappropriate behavior you will be demoted or removed."), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-4)',
      marginBottom: 0,
      color: 'var(--text-muted)'
    }
  }, "Only Officers and the Guild Master can remove a guild member. The removal of any member is done using diplomacy. A brief Officer meeting is conducted and at least 3 Officers must agree to remove said player.")), /*#__PURE__*/React.createElement(Card, {
    eyebrow: "Officers",
    title: "Held to a higher standard"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Since Officers are expected to represent and enforce the guild rules and expectations, inappropriate behavior from an Officer is unacceptable. Please forward any Officer related concerns to the Guild Master."))), tab === 'ranks' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)'
    }
  }, "All \"Members\" are permitted to invite new recruits and all recruits will be promoted to \"Initiate\". Rank promotions are determined by Officers and the Guild Master. Your rank reflects your attitude, behaviour and positive contribution to the health and progression of our guild.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: 'var(--space-5)'
    }
  }, RANKS.map(r => /*#__PURE__*/React.createElement(Card, {
    key: r.rank,
    title: r.rank,
    action: /*#__PURE__*/React.createElement(Badge, {
      tone: r.tone
    }, r.perks.find(p => p.includes('gold')) ? r.perks.find(p => p.includes('gold')).replace(' guild repair allowance', '') : 'no repairs')
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-body)'
    }
  }, r.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginTop: 'var(--space-4)'
    }
  }, r.perks.map(p => /*#__PURE__*/React.createElement("div", {
    key: p,
    style: {
      display: 'flex',
      gap: 'var(--space-2)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "dot",
    size: 14,
    style: {
      color: 'var(--text-gold)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, p))))))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 'var(--space-6)',
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "crown",
    size: 20,
    style: {
      color: 'var(--text-gold)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)'
    }
  }, "If you are interested in becoming an Officer, please express your interest to any Officer or the Guild Master. Your interest will be considered at the next Officer meeting."))))));
}
Object.assign(window, {
  ExpectationsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/ExpectationsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HomeScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Icon,
  Tag,
  Tooltip
} = window.CRDGuildDesignSystem_3c68ee;
const KILLS = [{
  src: 'kill1',
  caption: 'Sentinels Defeat',
  prog: 'Venomous Abyss 2/8'
}, {
  src: 'kill2',
  caption: 'Vashnik Defeat',
  prog: 'Venomous Abyss 3/8'
}, {
  src: 'kill3',
  caption: 'Rotmire Defeat',
  prog: 'Venomous Abyss 3/8'
}];
const RAIDS = [{
  title: 'Heroic Progression',
  when: 'Every Saturday',
  who: 'Officer Perseffonee',
  tone: 'gold'
}, {
  title: 'Normal Alt Raid',
  when: 'Every Friday',
  who: 'Officer Vadailla',
  tone: 'info'
}, {
  title: 'Guild LFR & BFFs',
  when: 'Every Wednesday',
  who: 'Officer Quixxie',
  tone: 'success'
}];
const FEATURED = [{
  img: 'calendar',
  title: 'Guild Calendar Events',
  body: 'From farming to mythic keystones; to legacy raids and progression — an event calendar designed to meet a variety of interests.',
  route: 'events'
}, {
  img: 'midnight',
  title: 'Midnight Raiding with CRD',
  body: 'The Venomous Abyss. Heroic progression, alt raid and guild LFR every week.',
  route: 'events'
}, {
  img: 'contests',
  title: "Harima's Novel: Fall of Light",
  body: 'Chapter 3: Visions is now finished! Read why Harima must proceed with caution — one false step and the entire Alliance crumbles!',
  route: 'events'
}];
const NEWS = [{
  date: '11/08/26',
  by: 'Shortie',
  head: 'MAKE SOME NOISE FOR ADDY — OUR AUGUST GUILDIE OF THE MONTH!',
  intro: 'And honestly … this one makes PERFECT sense.',
  acrostic: [['A', 'Always among the first to fill those crafting orders! Need something crafted? Addy is already on it!'], ['D', "Dedicated to keeping us informed! He's constantly posting helpful resources in “Tips & Tricks,” keeping us updated on patch notes, changes, and anything else we need to know!"], ['D', 'Dedicated ALTAHOLIC! If there’s an empty character slot, Addy has probably already filled it.'], ['Y', 'You can always count on Addy for helpful advice, useful information … and a little clean dirty talk when the guild chat needs it.']],
  outro: 'And a HUGE congratulations to everyone else who received votes — Arkved, Haedrath, Oopsie, Pauhana, Shortie & Vitae!'
}, {
  date: '07/07/26',
  by: 'Shortie',
  head: 'LIGHT UP THE FIREWORKS!! July’s Guildie of the Month — Congratulations, Melfinnaa!',
  intro: 'Not every guild hero is measured by raid parses or Mythic+ scores. Some make a guild feel like home — and that’s exactly what Melfinnaa does.',
  acrostic: [['M', 'Magnetic — people naturally enjoy talking with her.'], ['E', 'Engaging — keeps guild chat lively and inclusive.'], ['L', 'Lively — brings energy and laughter.'], ['F', 'Friendly — always kind and welcoming.']],
  outro: 'Big congratulations as well to our other nominees and vote-getters: Addy, Foxxy, Odasa, Perseffonee and Snow!'
}];
function HomeScreen({
  go
}) {
  const [slide, setSlide] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % KILLS.length), 3600);
    return () => clearInterval(t);
  }, []);
  const kill = KILLS[slide];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Section, {
    title: "Our Vision",
    lede: "To establish a supportive community of players that respects and values each member's contribution, while participating in a variety of shared interests that support the wellbeing of our guild."
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.35fr .65fr',
      gap: 'var(--space-8)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-body)',
      fontSize: 'var(--text-body-m)',
      textWrap: 'pretty'
    }
  }, "We are a friendly, mature and supportive World of Warcraft guild, accepting of all races, classes, interests and gaming styles. We schedule weekly guild challenges, PvP; and nostalgic and progressive raids. We are \"casual\", but not without commitment. We are very committed to each other and the health and progression of our guild. By respecting the person behind the toon, CRD maintains a supportive and enjoyable experience for all its members, while also pursuing shared goals that allow us to progress as a guild."), /*#__PURE__*/React.createElement(Card, {
    crest: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "CRD's Anthem!"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-strong)',
      marginTop: 'var(--space-2)'
    }
  }, "By Foxxylady"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play",
    size: 16,
    style: {
      color: 'var(--text-gold)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 4,
      background: 'var(--surface-sunken)',
      boxShadow: 'var(--inset-well)',
      borderRadius: 'var(--radius-pill)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '18%',
      height: '100%',
      background: 'var(--grad-gold)',
      borderRadius: 'var(--radius-pill)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, "00:00 / 01:51"))))), /*#__PURE__*/React.createElement(Section, {
    title: "Midnight Raiding with CRD",
    lede: "The Venomous Abyss."
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 'var(--space-5)'
    }
  }, RAIDS.map(r => /*#__PURE__*/React.createElement(Card, {
    key: r.title,
    interactive: true,
    onClick: () => go('events')
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      letterSpacing: 'var(--tracking-display)',
      color: 'var(--text-strong)'
    }
  }, r.title), /*#__PURE__*/React.createElement(Badge, {
    tone: r.tone
  }, r.when.replace('Every ', ''))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-3)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, r.when), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      marginTop: 4
    }
  }, "Hosted by ", r.who))))), /*#__PURE__*/React.createElement(Section, {
    title: "Our Recent Accomplishments"
  }, /*#__PURE__*/React.createElement(Card, {
    padded: false,
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      aspectRatio: '980 / 407',
      background: 'var(--surface-sunken)'
    }
  }, KILLS.map((k, i) => /*#__PURE__*/React.createElement("img", {
    key: k.caption,
    src: IMG[k.src],
    alt: k.caption,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: i === slide ? 1 : 0,
      transition: 'opacity var(--dur-slow) var(--ease-out)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--grad-protect-bottom)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'var(--space-6)',
      bottom: 'var(--space-5)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-display-s)',
      color: 'var(--parchment-100)',
      letterSpacing: 'var(--tracking-display)'
    }
  }, kill.caption), /*#__PURE__*/React.createElement(Badge, {
    tone: "gold"
  }, kill.prog)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 'var(--space-6)',
      bottom: 'var(--space-5)',
      display: 'flex',
      gap: 'var(--space-2)'
    }
  }, KILLS.map((k, i) => /*#__PURE__*/React.createElement("span", {
    key: k.caption,
    onClick: () => setSlide(i),
    style: {
      width: 8,
      height: 8,
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      background: i === slide ? 'var(--gold-300)' : 'rgba(244,227,176,.3)'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--space-6)',
      borderTop: '1px solid var(--border-hairline)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, slide + 1, "/14"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Kill shots from Heroic progression, Saturdays with Officer Perseffonee."), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    style: {
      marginLeft: 'auto'
    },
    iconRight: "chevron-right",
    onClick: () => go('progression')
  }, "Raid Progression")))), /*#__PURE__*/React.createElement(Section, {
    title: "Our Featured Events"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 'var(--space-5)'
    }
  }, FEATURED.map(f => /*#__PURE__*/React.createElement(Card, {
    key: f.title,
    padded: false,
    interactive: true,
    onClick: () => go(f.route)
  }, /*#__PURE__*/React.createElement("img", {
    src: IMG[f.img],
    alt: "",
    style: {
      width: '100%',
      height: 143,
      objectFit: 'cover',
      display: 'block',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      letterSpacing: 'var(--tracking-display)',
      color: 'var(--text-strong)'
    }
  }, f.title), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, f.body), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--text-label)',
      fontWeight: 700,
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      color: 'var(--text-gold)'
    }
  }, "Read More")))))), /*#__PURE__*/React.createElement(Section, {
    title: "Latest Guild News"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr .42fr',
      gap: 'var(--space-8)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, NEWS.map(n => /*#__PURE__*/React.createElement(Card, {
    key: n.date,
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-gold)'
    }
  }, n.date), /*#__PURE__*/React.createElement("h4", {
    style: {
      marginTop: 'var(--space-3)',
      color: 'var(--parchment-100)'
    }
  }, n.head), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 'var(--space-5)',
      color: 'var(--text-body)'
    }
  }, n.intro), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, n.acrostic.map(([letter, text]) => /*#__PURE__*/React.createElement("div", {
    key: letter + text,
    style: {
      display: 'flex',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 900,
      fontSize: 'var(--text-title-l)',
      color: 'var(--gold-300)',
      width: 22,
      flex: 'none',
      lineHeight: 1.1
    }
  }, letter), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-body)'
    }
  }, text)))), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-5)',
      marginBottom: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, n.outro)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-3) var(--space-6)',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--grad-header)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "crown",
    size: 13,
    style: {
      color: 'var(--text-gold)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, "Posted by Officer ", n.by)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconRight: "chevron-right"
  }, "Click here for older posts"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padded: false
  }, /*#__PURE__*/React.createElement("img", {
    src: IMG.gotmFrame,
    alt: "",
    style: {
      width: '100%',
      height: 'auto',
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-5)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "August's Member of the Month"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-display-s)',
      color: 'var(--gold-200)',
      letterSpacing: 'var(--tracking-display)',
      marginTop: 'var(--space-2)'
    }
  }, "Addy!"))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "Are You A New Member?"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Ask any Officer and we'll be glad to discuss with you all that CRD has to offer!"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    onClick: () => go('offer')
  }, "What We Offer")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "Quick Facts"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-3)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Server \xB7 The Scryers"), /*#__PURE__*/React.createElement("span", null, "Faction \xB7 Horde Retaliation"), /*#__PURE__*/React.createElement("span", null, "Founded \xB7 2010"), /*#__PURE__*/React.createElement("span", null, "Progression \xB7 3/8 Heroic"), /*#__PURE__*/React.createElement("span", null, "Guild bank \xB7 8 tabs")))))));
}
Object.assign(window, {
  HomeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/OfferScreen.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Icon,
  Tag
} = window.CRDGuildDesignSystem_3c68ee;
const OFFERS = ['a mature, supportive and respectful environment', 'an active guild', 'for the "casual" player, a no-fault community; a place to level and learn', 'for the more "serious" player, we have an event calendar designed to meet a variety of interests', '8 guild bank tabs: access depends on your guild rank', 'Discord — link provided in-game', 'this website', 'combat logs and raid progression videos', 'a YouTube channel', 'a Facebook page; search for "Casual Raid Days!" and send a request', 'a Casual Raid Days guild on Classic too'];
function OfferScreen({
  go
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Section, {
    title: "The Success Of A Guild"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-body)',
      fontSize: 'var(--text-body-l)',
      maxWidth: 860,
      textWrap: 'pretty'
    }
  }, "The success of a guild is a communal responsibility that begins with loyal members who respect each other. Whether it be questing, farming mats, supporting low-level guild members, donating to the guild bank, spreading friendly cheer and enthusiasm, accomplishing weekly guild challenges, earning guild achievements, crafting items, being a reliable member of one of our raid or PvP teams, organizing the guild bank, scheduling a variety of guild events, enforcing guild rules and expectations, investing and devoting time into our website, or a member who plays a little or a lot \u2014 every member, all in different capacities, participates in the health and progression of the guild."), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-5)',
      marginBottom: 0,
      color: 'var(--text-muted)',
      maxWidth: 860
    }
  }, "Therefore, we ask new recruits to respect our", ' ', /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('expectations');
    }
  }, "guild expectations"), ' ', "and make a positive contribution. If you do so, you will advance in rank.")), /*#__PURE__*/React.createElement(Section, {
    title: "What Does Our Guild Offer?"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.3fr .7fr',
      gap: 'var(--space-8)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padded: false
  }, OFFERS.map((o, i) => /*#__PURE__*/React.createElement("div", {
    key: o,
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      padding: 'var(--space-3) var(--space-6)',
      borderTop: i ? '1px solid var(--border-hairline)' : 0,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15,
    style: {
      color: 'var(--status-success)',
      marginTop: 4
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)'
    }
  }, o)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    crest: true
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-display-s)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, "\u201CWe are the most hard-core, casual guild.\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-4)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "To quote a former and beloved Officer, Celyndrashad.")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "Are You A New Member?"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Ask any Officer and we'll be glad to discuss with you all that CRD has to offer!"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    onClick: () => go('register')
  }, "Register"))))), /*#__PURE__*/React.createElement(Section, {
    title: "Pay It Forward"
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "heart-handshake",
    size: 22,
    style: {
      color: 'var(--text-gold)',
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-body)',
      maxWidth: 760
    }
  }, "Crafted equipment, enchants and gems, provided you have the mats, are offered free to guild members. Pay these gestures forward and be a positive contributor to the guild. ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-strong)'
    }
  }, "Do not be a taker."), " Be mindful of your withdrawals from the bank and ensure all requests of others are reasonable, appreciated and returned."))), /*#__PURE__*/React.createElement(Section, {
    title: "Guild Member of the Month",
    lede: "Is there a guild member who is contributing to the health and progression of the guild, \u201Cpaying it forward\u201D to others, and a loyal, positive and supportive member? Then vote for them for Guildie of the Month. Voting is easy!"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 'var(--space-5)'
    }
  }, [['Cast your vote', 'Before the end of the month, message Officer Shortie in Discord. Anyone can be nominated.'], ['Votes are tallied', 'At the end of each month Officer Shortie tallies the votes; the person with the most votes wins. In a tie, she spins the wheel.'], ['The winner is recognized', 'The winner is invited to attend one Officer meeting, to share ideas, comments and/or speak on behalf of the guild.']].map(([h, p], i) => /*#__PURE__*/React.createElement(Card, {
    key: h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-gold)',
      fontSize: 'var(--text-body-s)'
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      letterSpacing: 'var(--tracking-display)',
      color: 'var(--text-strong)'
    }
  }, h)), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    iconRight: "chevron-right",
    onClick: () => go('events')
  }, "Guild Events"))));
}
Object.assign(window, {
  OfferScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/OfferScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/RegisterScreen.jsx
try { (() => {
const {
  Card,
  Button,
  Input,
  Select,
  Checkbox,
  RadioGroup,
  Switch,
  Badge,
  Icon,
  Dialog
} = window.CRDGuildDesignSystem_3c68ee;
function RegisterScreen({
  onSubmitted,
  go
}) {
  const [agreed, setAgreed] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  return /*#__PURE__*/React.createElement(Section, {
    title: "Register",
    lede: "The Members page is password protected. Register to become a member! An Officer reviews every registration \u2014 you'll hear back in Discord or in-game.",
    narrow: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr .55fr',
      gap: 'var(--space-8)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padded: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Main character",
    placeholder: "Name \u2014 The Scryers",
    icon: "user"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Battle.net tag",
    placeholder: "you#1234",
    icon: "at-sign"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Class",
    options: ['Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior']
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Are you already in CRD?",
    options: ['Yes, in-game member', 'No, new recruit', 'Returning member']
  })), /*#__PURE__*/React.createElement(RadioGroup, {
    label: "How do you mostly play?",
    row: true,
    value: "A little of everything",
    onChange: () => {},
    options: ['A little', 'A lot', 'A little of everything']
  }), /*#__PURE__*/React.createElement("div", {
    className: "crd-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crd-label"
  }, "Interests"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 2
    }
  }, ['Heroic progression (Saturdays)', 'Alt raid (Fridays)', 'Guild LFR (Wednesdays)', 'Mythic keys', 'Legacy raids', 'Delves & shenanigans', 'Farming & fishing brunch', 'PvP', 'Contests & silliness'].map(n => /*#__PURE__*/React.createElement(Checkbox, {
    key: n,
    label: n,
    defaultChecked: n.startsWith('Heroic')
  })))), /*#__PURE__*/React.createElement(Input, {
    label: "Tell us about yourself",
    multiline: true,
    rows: 4,
    hint: "However much or little you like. We read every one."
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Add me to the Discord announcements",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "I have read the guild expectations and will be a positive contributor",
    checked: agreed,
    onChange: setAgreed
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4) var(--space-6)',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--grad-header)'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('expectations');
    },
    style: {
      fontSize: 'var(--text-body-s)'
    }
  }, "Read the guild expectations"), /*#__PURE__*/React.createElement(Button, {
    disabled: !agreed,
    iconRight: "chevron-right",
    onClick: () => setConfirm(true)
  }, "Register"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    eyebrow: "What happens next",
    title: "Three steps"
  }, [['An Officer reviews it', 'All "Members" may invite recruits; every recruit is promoted to "Initiate".'], ['A word in Discord', 'The link is provided in-game. Ask any Officer anything.'], ['You advance in rank', 'Respect our expectations and make a positive contribution, and you will advance.']].map(([h, p], i) => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      paddingTop: i ? 'var(--space-4)' : 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-gold)',
      fontSize: 'var(--text-body-s)'
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-strong)',
      fontSize: 'var(--text-body-s)'
    }
  }, h), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-body-s)'
    }
  }, p))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "heart-handshake",
    size: 18,
    style: {
      color: 'var(--text-gold)',
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "For the \"casual\" player, a no-fault community; a place to level and learn. For the more \"serious\" player, an event calendar designed to meet a variety of interests."))))), /*#__PURE__*/React.createElement(Dialog, {
    open: confirm,
    eyebrow: "Registration",
    title: "Send this to the Officers?",
    onClose: () => setConfirm(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setConfirm(false)
    }, "Keep editing"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        setConfirm(false);
        onSubmitted && onSubmitted();
      }
    }, "Register"))
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "An Officer will reach out in Discord or in-game. Welcome to Casual Raid Days!")));
}
Object.assign(window, {
  RegisterScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/RegisterScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SiteChrome.jsx
try { (() => {
const {
  Crest,
  Button,
  Icon,
  IconButton,
  Card,
  Badge
} = window.CRDGuildDesignSystem_3c68ee;
const CDN = 'https://static.wixstatic.com/media/';
const IMG = {
  hero: CDN + '31d447_029d82b94b2a448a86ef190e50f3de49.jpg/v1/fill/w_1280,h_800,al_c,q_85,enc_avif,quality_auto/31d447_029d82b94b2a448a86ef190e50f3de49.jpg',
  classLeft: CDN + '41d000_d49faecea6ad062f5aa1b47b69affca6.png/v1/fill/w_57,h_80,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/41d000_d49faecea6ad062f5aa1b47b69affca6.png',
  classRight: CDN + '41d000_bfb8ab6e65a6cc88af75d53ff54db6ce.png/v1/fill/w_57,h_80,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/41d000_bfb8ab6e65a6cc88af75d53ff54db6ce.png',
  footer: CDN + '31d447_bf676b6ebb1f46b8bc2adb2d24976b6c~mv2.png/v1/fill/w_978,h_171,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Footer.png',
  gotmFrame: CDN + '1ba88bc01c874d5ed24ec8c5a38f29c7.png/v1/fill/w_232,h_350,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/1ba88bc01c874d5ed24ec8c5a38f29c7.png',
  kill1: CDN + '31d447_a1e9bc3103ec44c4bac4567988306f5c~mv2.png/v1/fill/w_980,h_407,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/31d447_a1e9bc3103ec44c4bac4567988306f5c~mv2.png',
  kill2: CDN + '31d447_4167b8adff4f4a009024387d22fb94ec~mv2.png/v1/fill/w_980,h_402,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/31d447_4167b8adff4f4a009024387d22fb94ec~mv2.png',
  kill3: CDN + '31d447_e3b44e4b075347548ec4e95e7e1d8d23~mv2.png/v1/fill/w_868,h_487,al_c,q_90,enc_avif,quality_auto/31d447_e3b44e4b075347548ec4e95e7e1d8d23~mv2.png',
  calendar: CDN + '31d447_85ac7ae8e6cf468d82799de441909894~mv2.jpg/v1/fill/w_372,h_143,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/calendar%20of%20events.jpg',
  contests: CDN + '31d447_826dacab93ac499e967d4e6d343273e6.jpg/v1/fill/w_183,h_126,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/31d447_826dacab93ac499e967d4e6d343273e6.jpg',
  legacy: CDN + '31d447_7398ddc44a4a400e866cb86832b14c2b.jpg/v1/fill/w_183,h_126,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/31d447_7398ddc44a4a400e866cb86832b14c2b.jpg',
  keysSunday: CDN + "31d447_47a08b6402814f3b8005ad8dde14a721~mv2.png/v1/crop/x_28,y_0,w_1480,h_1024/fill/w_183,h_126,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/dawnrunner%20keys.png",
  keysMonday: CDN + "31d447_096f8e877e104f9f9c8f3fcc4e0ef9ee~mv2.png/v1/crop/x_28,y_0,w_1480,h_1024/fill/w_183,h_126,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/harima's%20keys.png",
  shenanigans: CDN + "31d447_cbed4420048b43d18d784ca54d469c97~mv2.png/v1/crop/x_0,y_411,w_1024,h_714/fill/w_183,h_127,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/shorties%20shenanigans.png",
  brunch: CDN + "31d447_af563ca457a54c00ab8e2f2fd38c1300~mv2.png/v1/crop/x_112,y_0,w_976,h_675/fill/w_183,h_126,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/hotvchik's%20feast.png",
  midnight: CDN + '31d447_34ae3648f3dc41828a6af9a874e92053~mv2.avif/v1/fill/w_183,h_126,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/midnight-logo-1.avif',
  advKeys: CDN + '31d447_65d0c00b88c44a6eaa3263acd68f4a4e.png/v1/crop/x_26,y_1,w_311,h_215/fill/w_183,h_126,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/dungeon_finder.png'
};
const NAV = [{
  key: 'home',
  label: 'Home'
}, {
  key: 'offer',
  label: 'What We Offer'
}, {
  key: 'expectations',
  label: 'Guild Expectations'
}, {
  key: 'events',
  label: 'Guild Events'
}, {
  key: 'progression',
  label: 'Raid Progression'
}, {
  key: 'members',
  label: 'Members'
}, {
  key: 'officers',
  label: 'Officer Roster'
}];
function HeroBanner({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minHeight: 420,
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
      overflow: 'hidden',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: IMG.hero,
    alt: "",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: 'saturate(.85)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--grad-protect-bottom)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(10,9,7,.42)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: 'var(--space-12) var(--gutter-page)'
    }
  }, /*#__PURE__*/React.createElement(Crest, {
    size: 132,
    assetBase: "../../assets",
    style: {
      display: 'inline-block'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      color: 'var(--parchment-100)',
      letterSpacing: 'var(--tracking-display)',
      fontSize: 'var(--text-display-s)',
      marginTop: 'var(--space-4)'
    }
  }, "Welcome to"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-display-xl)',
      color: 'var(--gold-200)',
      textShadow: '0 3px 14px rgba(0,0,0,.8)',
      marginTop: 'var(--space-2)'
    }
  }, "Casual Raid Days"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      color: 'var(--parchment-100)',
      letterSpacing: 'var(--tracking-display)',
      fontSize: 'var(--text-title-l)',
      marginTop: 'var(--space-3)'
    }
  }, "The Scryers \u2014 Horde Retaliation"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--gold-300)',
      fontSize: 'var(--text-label)',
      marginTop: 'var(--space-2)'
    }
  }, "est. since 2010"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: () => go('register')
  }, "Register")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-3)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--parchment-300)'
    }
  }, "The Members page is password protected. Register to become a member!")));
}
function NavBar({
  route,
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'rgba(18,16,12,.92)',
      backdropFilter: 'var(--blur-panel)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-page)',
      margin: '0 auto',
      padding: '0 var(--gutter-page)',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: IMG.classLeft,
    alt: "",
    style: {
      height: 34,
      width: 'auto'
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      flex: 1,
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, NAV.map(n => /*#__PURE__*/React.createElement("a", {
    key: n.key,
    href: "#",
    onClick: e => {
      e.preventDefault();
      go(n.key);
    },
    style: {
      border: 0,
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--text-label)',
      fontWeight: 700,
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      color: route === n.key ? 'var(--text-gold)' : 'var(--text-muted)'
    }
  }, n.label))), /*#__PURE__*/React.createElement("img", {
    src: IMG.classRight,
    alt: "",
    style: {
      height: 34,
      width: 'auto'
    }
  })));
}
const QUICK_LINKS = ['Battle.net', 'Blizzard Watch', 'Combat Logs', "CRD's YouTube Channel", "CRD's Music Playlist", "CRD's Facebook Page", 'CurseForge', 'Discord', 'Icy Veins', 'Raider.IO', 'The Scryers Forums', 'WoW Analyzer', 'WoW Armory', 'WoW Head'];
const ACTIVE_OFFICERS = ['Harima', 'Hotchick', 'Perseffonee [GM]', 'Quixxie', 'Shortie', 'Vadailla [Co-GM]', 'Zalanto'];
const RETIRED = 'Anicetus, Caine, Calesong, Celyndrashad, Chûcknorris, Dakkin, Datgoblin, Deriela, Ellette, Flanoira, Gnazz, Gordn, Hellis, Jinnae, Kyourin, Myrlin, Nighcon, Oopsie, Prophyria, Raphayela, Roku, Savvy, Scahl, Schnozz, Smytra, Soar, Sorrick, Soulafein, Spellcheck & Tyin';
function SiteFooter() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      marginTop: 'var(--space-20)',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-page)',
      margin: '0 auto',
      padding: 'var(--space-12) var(--gutter-page)',
      display: 'grid',
      gridTemplateColumns: '1fr 1.1fr .9fr',
      gap: 'var(--space-10)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-title-s)',
      letterSpacing: 'var(--tracking-display)',
      color: 'var(--text-strong)'
    }
  }, "WoW Community \u2014 Quick Links"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-1) var(--space-4)',
      marginTop: 'var(--space-4)'
    }
  }, QUICK_LINKS.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      border: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, l)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-title-s)',
      letterSpacing: 'var(--tracking-display)',
      color: 'var(--text-strong)'
    }
  }, "Guild Officers"), /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow",
    style: {
      marginTop: 'var(--space-3)'
    }
  }, "Active Officers"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-1) var(--space-4)',
      marginTop: 'var(--space-2)'
    }
  }, ACTIVE_OFFICERS.map(o => /*#__PURE__*/React.createElement("a", {
    key: o,
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      border: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, o))), /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow",
    style: {
      marginTop: 'var(--space-5)'
    }
  }, "Honorary or Retired Officers"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-2)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-faint)',
      lineHeight: 'var(--leading-normal)'
    }
  }, RETIRED), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "In Loving Memory, ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault()
  }, "Nenda"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "PayPal Donations"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "All donations are deposited into Perseffonee's PayPal account and go toward the cost of guild leadership. Any donation is greatly appreciated."), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    block: true
  }, "Donate with PayPal")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, "Guildie of the Month"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-3)',
      marginBottom: 0,
      fontSize: 'var(--text-body-s)',
      color: 'var(--text-muted)'
    }
  }, "Before the end of the month, be sure to message Officer Shortie to cast your vote!")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      paddingBottom: 'var(--space-8)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: IMG.footer,
    alt: "",
    style: {
      maxWidth: '100%',
      height: 'auto',
      opacity: .95
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      marginTop: 'var(--space-4)'
    }
  }, "Copyright \xA9 2015 Casual Raid Days. All Rights Reserved.")));
}
function Section({
  title,
  lede,
  children,
  narrow = false,
  eyebrow
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: narrow ? 'var(--container-narrow)' : 'var(--container-page)',
      margin: '0 auto',
      padding: 'var(--space-16) var(--gutter-page) 0'
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "crd-eyebrow"
  }, eyebrow), title && /*#__PURE__*/React.createElement("h2", {
    style: {
      marginTop: eyebrow ? 'var(--space-3)' : 0
    }
  }, title), title && /*#__PURE__*/React.createElement("hr", {
    className: "crd-rule",
    style: {
      margin: 'var(--space-4) 0 0'
    }
  }), lede && /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 'var(--space-5)',
      maxWidth: 720,
      fontSize: 'var(--text-body-l)',
      color: 'var(--text-body)',
      textWrap: 'pretty'
    }
  }, lede), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-6)'
    }
  }, children));
}
function ComingSoon({
  title,
  note
}) {
  return /*#__PURE__*/React.createElement(Section, {
    title: title
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 18,
    style: {
      color: 'var(--text-gold)',
      marginTop: 3
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-strong)'
    }
  }, "Not recreated"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-body-s)'
    }
  }, note))));
}
Object.assign(window, {
  HeroBanner,
  NavBar,
  SiteFooter,
  Section,
  ComingSoon,
  IMG,
  NAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SiteChrome.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Crest = __ds_scope.Crest;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
