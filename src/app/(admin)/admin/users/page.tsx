"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminToolbar } from "@/components/admin/AdminToolbar";

interface UserItem {
  id: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  bonusQueries: number;
  totalPoints: number;
  createdAt: string;
  membership: {
    plan: string;
    status: string;
  } | null;
  _count: {
    consultationRecords: number;
    paymentOrders: number;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState("");
  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const totalPages = Math.ceil(total / pageSize);

  const planLabel = (plan: string) => {
    switch (plan) {
      case "MONTHLY": return "包月";
      case "QUARTERLY": return "包季";
      case "YEARLY": return "包年";
      default: return "免费";
    }
  };

  return (
    <>
      <AdminPageHeader
        icon="ti-users"
        title="用户管理"
        desc="查看和管理所有注册用户"
      />

      <AdminToolbar
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "搜索昵称/手机/邮箱...",
          onEnter: handleSearch,
        }}
      >
        <Button variant="outline" size="sm" onClick={handleSearch}>
          <i className="ti ti-search" />
          搜索
        </Button>
      </AdminToolbar>

      {error && (
        <div className="admin-alert error">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>昵称</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>会员等级</TableHead>
              <TableHead className="text-right">排盘次数</TableHead>
              <TableHead className="text-right">支付订单</TableHead>
              <TableHead className="text-right">积分</TableHead>
              <TableHead>注册时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="admin-table-empty">
                  暂无用户数据
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.nickname || "未设置"}
                  </TableCell>
                  <TableCell className="text-muted">{user.phone || "—"}</TableCell>
                  <TableCell className="text-muted">{user.email || "—"}</TableCell>
                  <TableCell>
                    {user.role === "ADMIN" ? (
                      <span className="admin-badge info">管理员</span>
                    ) : (
                      <span className="admin-badge neutral">用户</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        user.membership?.plan && user.membership.plan !== "FREE"
                          ? "admin-badge success"
                          : "admin-badge neutral"
                      }
                    >
                      {planLabel(user.membership?.plan || "FREE")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{user._count.consultationRecords}</TableCell>
                  <TableCell className="text-right tabular-nums">{user._count.paymentOrders}</TableCell>
                  <TableCell className="text-right tabular-nums">{user.totalPoints}</TableCell>
                  <TableCell className="text-xs text-muted">
                    {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <span className="admin-pagination-info">
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className="admin-pagination-actions">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <i className="ti ti-chevron-left" />
              上一页
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              下一页
              <i className="ti ti-chevron-right" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
