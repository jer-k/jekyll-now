// @flow strict
import React from 'react';
import { graphql } from 'gatsby';
import Layout from '../components/Layout';
import Post from '../components/Post';
import Header from '../components/Header';
import { useSiteMetadata } from '../hooks';
import type { MarkdownRemark } from '../types';

type Props = {
  data: {
    markdownRemark: MarkdownRemark
  }
};

const PostTemplate = ({ data }: Props) => {
  const { title: siteTitle, subtitle: siteSubtitle } = useSiteMetadata();
  const { frontmatter, excerpt } = data.markdownRemark;
  const { title: postTitle, description: postDescription } = frontmatter;

  return (
    <Layout title={`${postTitle} - ${siteTitle}`} description={postDescription} >
      <Header />
      <Post post={data.markdownRemark} />
    </Layout>
  );
};

export const query = graphql`
  query PostBySlug($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      html
      fields {
        slug
        tagSlugs
      }
      excerpt(format: HTML)
      frontmatter {
        date
        description
        tags
        title
      }
    }
  }
`;

export default PostTemplate;
