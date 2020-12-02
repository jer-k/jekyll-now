// @flow strict
import React from 'react';
import styles from './Header.module.scss';
import Author from '../Author';
import Menu from '../Menu';
import { useSiteMetadata } from '../../hooks';

type Props = {
  isIndex?: boolean,
};

const Header = ({ isIndex }: Props) => {
  const { author, copyright, menu } = useSiteMetadata();

  return (
    <>
    <div className={styles['header']}>
      <div className={styles['header__inner']}>
        <Author author={author} isIndex={isIndex} />
        <Menu menu={menu} />
      </div>
    </div>
    </>

  );
};

export default Header;
