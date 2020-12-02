import React, { useRef, useEffect } from 'react';
import styles from './Page.module.scss';
import Footer from '../Footer';

type Props = {
  title?: string,
  children: React.Node
};

const Page = ({ title, children }: Props) => {
  return (
    <div className={styles['page']}>
      <div className={styles['page__inner']}>
        { title && <h1 className={styles['page__title']}>{title}</h1>}
        <div className={styles['page__body']}>
          {children}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Page;