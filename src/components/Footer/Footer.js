// @flow strict
import React from 'react';
import styles from './Footer.module.scss';
import Copyright from '../Copyright';
import Contacts from '../Contacts';
import { useSiteMetadata } from '../../hooks';
import { Grid } from '@material-ui/core';

const Footer = () => {
  const { author, copyright, menu } = useSiteMetadata();

  return (
    <Grid item container xs={12} justify='center'>
      <div className={styles['footer']}>
        <div className={styles['footer_inner']}>
          <Contacts contacts={author.contacts} />
          <Copyright copyright={copyright} />
        </div>
      </div>
    </Grid>
  );
};

export default Footer;
