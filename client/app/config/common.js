if (require === undefined) {
  var require = {};
}
if (require.paths == null) {
  require.paths = {};
}
if (require.shim == null) {
  require.shim = {};
}

require.paths = Object.assign(require.paths, {
  jquery: "vendor/jquery",
  bootstrap: "vendor/bootstrap.min",
  constants: "helper/constants",
  Handsontable: "vendor/handsontable",
  filesaver: "vendor/filesaver",
  XLSX: "vendor/xlsx",
  spin: "vendor/spin",
  forge: "vendor/forge",
  Ladda: "vendor/ladda",
  qtip: "vendor/jquery_qtip",
  alertHandler: "helper/alertHandler",
  alertify: "vendor/alertify",
  alertify_defaults: "helper/alertify_defaults",
  DropSheet: "helper/drop_sheet",
  mpc: "helper/mpc",
  pki: "helper/pki",
  ResizeSensor: "vendor/ResizeSensor",
  "survey-jquery": "vendor/survey.jquery.min",
});

require.shim = Object.assign(require.shim, {
  bootstrap: {
    deps: ["jquery"],
  },
  spin: {
    exports: "spin",
  },
  Ladda: {
    deps: ["spin"],
    exports: "Ladda",
  },
});
