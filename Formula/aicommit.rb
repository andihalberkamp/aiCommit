class Aicommit < Formula
  desc "Generate clean Git commit messages from staged changes using Codex or Claude Code"
  homepage "https://github.com/andihalberkamp/aiCommit"
  url "https://registry.npmjs.org/@ahalberkamp/aicommit/-/aicommit-1.0.1.tgz"
  sha256 "93197e68ad1d89a714d8b051706db33ac8d4388a5fd0ce56773f586aa0c3c512"
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
