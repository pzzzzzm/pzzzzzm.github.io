---
layout: post
title: "图论基础（一）：一些图的基础概念"
subtitle: "Fundamentals of Graph Theory #1: Some basic concepts of graphs"
date: 2022-06-24
author: "BeanPudding"
header-img: "img/post-math.jpg"
tags: 
    - 图论
    # - 系列
---

# 图 (Graph)

一个图由节点 (vertex) 和边 (edge) 组成，可以被表示为,

$$
\mathcal{G} = \{\mathcal{V, E}\}
$$

其中，$\mathcal{V} = \{v_1, ..., v_N\}$ 是节点的集合，$\mathcal{E} = \{e_1, ..., e_M\}$ 是边的集合。图的大小被定义为节点的数量，即 $\|\mathcal{V}\|$。假设一条边 $e_i$ 连接了节点 $v_n$ 和 $v_m$，那么这条边也可以被表示为 $(v_n, v_m)$。如果是有向图，这表明这条边由 $v_n$ 指向 $v_m$。

## 邻接矩阵 (Adjacency Matrix)

假设一个图的节点数量 $\|\mathcal{V}\| = N$，则其邻接矩阵 $\textbf{A}$ 的大小为 $N \times N$，其中 $a_{i,j}$ 表示了 $v_i$ 和 $v_j$ 的连接关系，$1$ 为相接，$0$ 为不相连。

## 度 (Degree)

在一个图中，节点 $v_i \in \mathcal{V}$ 的度为与其相关联的边的数目。通过邻接矩阵计算：

$$
d(v_i) = \sum_{j=1}^N a_{i,j}
$$

### 邻域 (Neighborhood)

节点 $v_i$ 的邻域 $\mathcal{N}(v_i)$ 是所有与其相连的节点的集合。邻域中元素的个数与该节点的度相等，即 $d(v_i) = \|\mathcal{N}(v_i)\|$。

## 连通度 (Connectivity)

tbd

<!-- 途径 walk
    迹 trail
    路 path
    A^n
    子图
    连通分量
    连通图
    最短路
    直径 -->
    
<!-- 中心性 centrality -->


