// @flow strict
import React from 'react';
import { withPrefix, Link } from 'gatsby';
import styles from './Author.module.scss';
import { Grid } from "@material-ui/core";

type Props = {
  author: {
    name: string,
    bio: string,
    photo: string
  },
  isIndex: ?boolean
};

const Author = ({ author, isIndex }: Props) => (
  <Grid container className={styles['author']}>

      <Grid item xs={12} md={3}>
        <Link to="/">
          <img
            src={withPrefix(author.photo)}
            className={styles['author__photo']}
            width="150"
            height="150"
            alt={author.name}
          />
        </Link>
      </Grid>
      <Grid xs={12} md={9}>
      <div className={styles['author__text']}>
    { isIndex === true ? (
      <h1 className={styles['author__title']}>
        <Link className={styles['author__title-link']} to="/">{author.name}</Link>
      </h1>
    ) : (
      <h2 className={styles['author__title']}>
        <Link className={styles['author__title-link']} to="/">{author.name}</Link>
      </h2>
    )}
    <p className={styles['author__subtitle']}>{author.bio}</p>
    </div>
      </Grid>
  </Grid>

);

export default Author;
