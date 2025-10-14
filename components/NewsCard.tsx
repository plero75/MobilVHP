
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './Card';
import { useInterval } from '../hooks/useInterval';
import { fetchNews } from '../services/api';
import type { NewsArticle } from '../types';

export const NewsCard: React.FC = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNews = useCallback(async () => {
    setLoading(true);
    const articles = await fetchNews();
    setNews(articles);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useInterval(loadNews, 15 * 60 * 1000); // Refresh news every 15 minutes

  useInterval(() => {
    if (news.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % news.length);
    }
  }, 10 * 1000); // Rotate every 10 seconds

  const currentArticle = news[currentIndex];

  return (
    <Card title={<strong>France Info — Flash</strong>}>
      <div className="min-h-[44px]">
        {loading ? (
          <div>Chargement...</div>
        ) : currentArticle ? (
          <div>
            <div className="font-bold">{currentArticle.title}</div>
            <div className="text-sm text-gray-700">{currentArticle.desc}</div>
          </div>
        ) : (
          <div>Actualités indisponibles.</div>
        )}
      </div>
    </Card>
  );
};
