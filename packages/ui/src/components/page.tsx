"use client";

import React from "react";
import { capitalize } from "../lib/utils";

interface PageProps {
  children: React.ReactNode;
}

interface PageHeaderProps {
  children: React.ReactNode;
  title?: string;
}

interface PageContentProps {
  children: React.ReactNode;
}

export const Page = ({ children }: PageProps) => {
  return <div>{children}</div>;
};

export const PageHeader = ({ children, title }: PageHeaderProps) => {
  const pageTitle = title ? capitalize(title) : null;

  return (
    <div className="flex items-center justify-between py-4">
      {pageTitle ? (
        <h1 className="text-xl font-semibold">{pageTitle}</h1>
      ) : null}
      {children}
    </div>
  );
};

export const PageContent = ({ children }: PageContentProps) => {
  return <div>{children}</div>;
};
