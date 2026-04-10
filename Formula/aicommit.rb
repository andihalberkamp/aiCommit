class Aicommit < Formula
  desc "Generate clean Git commit messages from staged changes using Codex or Claude Code"
  homepage "https://github.com/andihalberkamp/aiCommit"
  url "https://registry.npmjs.org/@ahalberkamp/aicommit/-/aicommit-1.0.0.tgz"
  sha256 "1777536ec7a3223415bf5ba3c457401f68bc48a700e099ef6ff401535fdf02f3"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(libexec)
    bin.install_symlink libexec/"bin/aicommit"
  end

  test do
    assert_match "Usage:", shell_output("#{bin}/aicommit --help")
  end
end
