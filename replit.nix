{pkgs}: {
  deps = [
    pkgs.lsof
    pkgs.jq
    pkgs.libxcrypt
    pkgs.glibcLocales
    pkgs.postgresql
  ];
}
