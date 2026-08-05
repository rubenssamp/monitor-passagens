import { Octokit } from "@octokit/rest";
import type { AppConfig } from "./config";

const CONFIG_REPO_PATH = "data/config.json";

function getOctokit(): { octokit: Octokit; owner: string; repo: string; branch: string } {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";

  if (!token || !repoFull) {
    throw new Error(
      "GITHUB_TOKEN / GITHUB_REPO não configurados — necessários para salvar mudanças de configuração.",
    );
  }

  const [owner, repo] = repoFull.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPO inválido: "${repoFull}" (esperado "owner/repo")`);
  }

  return { octokit: new Octokit({ auth: token }), owner, repo, branch };
}

/**
 * Comita a nova config.json no repositório via GitHub Contents API. Necessário porque o
 * dashboard roda em ambiente serverless (FS efêmero) — a única forma de persistir a mudança
 * de forma durável é escrevendo de volta no repo git.
 */
export async function commitConfig(config: AppConfig, message: string): Promise<void> {
  const { octokit, owner, repo, branch } = getOctokit();

  let sha: string | undefined;
  try {
    const existing = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: CONFIG_REPO_PATH,
      ref: branch,
    });
    if (!Array.isArray(existing.data) && existing.data.type === "file") {
      sha = existing.data.sha;
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status !== 404) throw err;
  }

  const content = Buffer.from(JSON.stringify(config, null, 2) + "\n", "utf-8").toString("base64");

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: CONFIG_REPO_PATH,
    message,
    content,
    branch,
    sha,
  });
}
