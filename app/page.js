import { load } from "cheerio";
import Link from "next/link";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.cn/v1",
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchRepoDetail = async (repoName) => {
  try {
    const response = await fetch(`https://api.github.com/repos/${repoName}`);
    if (!response.ok) throw new Error("Failed to fetch repo details");
    return await response.json();
  } catch (error) {
    console.error(`Error fetching repo details for ${repoName}:`, error);
    return null;
  }
};

const fetchMoonShotResponse = async (content, role) => {
  try {
    const completion = await client.chat.completions.create({
      model: "moonshot-v1-8k",
      messages: [
        {
          role: "system",
          content: role,
        },
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.3,
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error in request:", error);
    return "";
  }
};

const translateDescription = async (description) => {
  return await fetchMoonShotResponse(
    `${description} 翻译成中文`,
    "你是翻译专家，擅长各种语言翻译"
  );
};

const summarizeReadme = async (repoName) => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/readme`
    );
    if (!response.ok) throw new Error("Failed to fetch readme");

    const readmeData = await response.json();
    const readmeStr = atob(readmeData.content);

    return await fetchMoonShotResponse(
      `${readmeStr} 总结成200字的中文`,
      "你是翻译专家，擅长各种语言翻译和总结"
    );
  } catch (error) {
    console.error(`Error summarizing README for ${repoName}:`, error);
    return "";
  }
};

const fetchTrendingRepos = async () => {
  try {
    const res = await fetch("https://github.com/trending?since=daily");
    const htmlText = await res.text();
    const $ = load(htmlText);
    const repos = [];
    const elements = $("h2.h3.lh-condensed");

    for (const element of elements) {
      // 从 html 里解析出 repoName
      const repoName = $(element).find("a").attr("href").trim().substring(1);
      console.log("repoName", repoName);
      const repoDetail = await fetchRepoDetail(repoName);
      if (!repoDetail) continue;

      const translatedDescription = await translateDescription(
        repoDetail.description || "无描述"
      );

      // API 速率限制
      await delay(70 * 1000);

      const summary = await summarizeReadme(repoName);

      // API 速率限制
      await delay(70 * 1000);

      repos.push({
        name: repoName,
        desc: translatedDescription,
        summary,
      });
    }

    return repos;
  } catch (error) {
    console.error("Error fetching trending repositories:", error);
    return [];
  }
};

export default async function Home() {
  const repos = await fetchTrendingRepos();
  return (
    <div>
      <h1 className="mt-10 text-4xl font-bold leading-tight">
        Welcome to{" "}
        <a
          href="https://github.com/trending"
          className="text-[#0070f3] hover:underline focus:underline active:underline"
        >
          Trending Repositories!
        </a>
      </h1>

      <div className="prose dark:prose-invert">
        {repos.map((repo, index) => (
          <article key={index}>
            <Link href={`https://github.com/${repo.name}`}>
              <h2>{repo.name}</h2>
            </Link>
            {repo.desc && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                描述：{repo.desc}
              </p>
            )}
            {repo.summary && (
              <p className="font-semibold italic">AI总结: {repo.summary}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
