import React from 'react';
import type { Metadata } from 'next';
import CustomerMenuClient from './customer-menu-client';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: {
    token: string;
  };
}

export default function TablePage({ params }: PageProps) {
  return <CustomerMenuClient token={params.token} />;
}
