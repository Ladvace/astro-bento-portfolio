import rss from "@astrojs/rss";
import { getPublishedProjects } from "../lib/directus";
import sanitizeHtml from 'sanitize-html';

export async function GET(context) {
  const projects = await getPublishedProjects();
  return rss({
    title: "Henry Marinho - Projects",
    description: "Data analytics projects and case studies by Henry Marinho.",
    site: context.site,
    items: projects.map((project) => ({
      title: project.title,
      pubDate: project.date_created ? new Date(project.date_created) : undefined,
      description: project.description,
      content: sanitizeHtml(project.content || ''),
      link: `/es/blog/${project.slug}/`,
    })),
  });
}
