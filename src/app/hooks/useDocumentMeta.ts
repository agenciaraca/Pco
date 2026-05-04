import { useEffect } from 'react';

export interface DocumentMeta {
  title?: string;
  description?: string;
}

export function useDocumentMeta(meta: DocumentMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    if (meta.title) document.title = meta.title;

    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const twitterTitle = document.querySelector(
      'meta[name="twitter:title"]',
    ) as HTMLMetaElement | null;
    const description = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    const ogDescription = document.querySelector(
      'meta[property="og:description"]',
    ) as HTMLMetaElement | null;
    const twitterDescription = document.querySelector(
      'meta[name="twitter:description"]',
    ) as HTMLMetaElement | null;

    const prev = {
      ogTitle: ogTitle?.content,
      twitterTitle: twitterTitle?.content,
      description: description?.content,
      ogDescription: ogDescription?.content,
      twitterDescription: twitterDescription?.content,
    };

    if (meta.title) {
      if (ogTitle) ogTitle.content = meta.title;
      if (twitterTitle) twitterTitle.content = meta.title;
    }
    if (meta.description) {
      if (description) description.content = meta.description;
      if (ogDescription) ogDescription.content = meta.description;
      if (twitterDescription) twitterDescription.content = meta.description;
    }

    return () => {
      document.title = previousTitle;
      if (ogTitle && prev.ogTitle !== undefined) ogTitle.content = prev.ogTitle;
      if (twitterTitle && prev.twitterTitle !== undefined)
        twitterTitle.content = prev.twitterTitle;
      if (description && prev.description !== undefined) description.content = prev.description;
      if (ogDescription && prev.ogDescription !== undefined)
        ogDescription.content = prev.ogDescription;
      if (twitterDescription && prev.twitterDescription !== undefined)
        twitterDescription.content = prev.twitterDescription;
    };
  }, [meta.title, meta.description]);
}
