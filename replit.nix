{pkgs}: {
  deps = [
    pkgs.jq
    pkgs.libxcrypt
    pkgs.glibcLocales
    pkgs.postgresql
  ];
}
