"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import axios from "axios";
import type { Campaign, Pagination, Receipt, ReceiptStatus } from "./types";

const apiBase = () => frontendEnv().NEXT_PUBLIC_API_BASE_URL;

export const useCampaigns = (page: number, limit: number) => {
  return useQuery({
    queryKey: ["whatsapp-campaigns", page, limit],
    queryFn: async () => {
      const res = await axios.get<{
        status: string;
        data: { items: Campaign[]; pagination: Pagination };
      }>(`${apiBase()}/admin/whatsapp/campaigns`, {
        params: { page, limit },
        withCredentials: true,
      });
      return res.data.data ?? { items: [], pagination: null };
    },
  });
};

export const useCampaignDetail = (
  id: string | null,
  page: number,
  limit: number,
  status?: ReceiptStatus
) => {
  return useQuery({
    queryKey: ["whatsapp-campaign", id, page, limit, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;
      const res = await axios.get<{
        status: string;
        data: {
          campaign: Campaign;
          receipts: Receipt[];
          pagination: Pagination;
        };
      }>(`${apiBase()}/admin/whatsapp/campaigns/${id}`, {
        params,
        withCredentials: true,
      });
      return res.data.data;
    },
    enabled: Boolean(id),
  });
};
