"use client";

import styles from "./markers.module.css";

export function PrintButton(){return <a className={styles.print} href="/markers/aruco-markers-a5-id0-id1.pdf" target="_blank" rel="noreferrer">A5 PDFを開いて印刷</a>;}
