import React from 'react';
import CustomerMenuClient from './customer-menu-client';

interface PageProps {
  params: {
    token: string;
  };
}

export default function TablePage({ params }: PageProps) {
  return <CustomerMenuClient token={params.token} />;
}
