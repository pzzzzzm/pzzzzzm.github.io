---
layout: post
title: "图论基础（一）：一些图的基础概念"
subtitle: "Fundamentals of Graph Theory #1: Some basic concepts of graphs"
date: 2022-06-24
author: "BeanPudding"
header-img: "img/post-graph.jpg"
tags: 
    - 图论
    # - 系列
---

> 这一个系列主要参考了《图深度学习》的第二章“图论基础”，夹杂了一些课上学到的概念。因此，涉及的概念可能并不全面，且对图的描述主要基于无向图。

# 图 (Graph)

一个图由节点 (vertex) 和边 (edge) 组成，可以被表示为,

$$
\mathcal{G} = \{\mathcal{V, E}\}
$$

其中，$\mathcal{V} = \{v_1, ..., v_N\}$ 是节点的集合，$\mathcal{E} = \{e_1, ..., e_M\}$ 是边的集合。图的大小被定义为节点的数量，即 $\|\mathcal{V}\|$。假设一条边 $e_i$ 连接了节点 $v_n$ 和 $v_m$，那么这条边也可以被表示为 $(v_n, v_m)$。如果是有向图，这表明这条边由 $v_n$ 指向 $v_m$。

## 邻接矩阵 (Adjacency Matrix)

假设一个图的节点数量 $\|\mathcal{V}\| = N$，则其邻接矩阵 $\textbf{A}$ 的大小为 $N \times N$，其中 $a_{i,j}$ 表示了 $v_i$ 和 $v_j$ 的连接关系，$1$ 为相接，$0$ 为不相连。

![](/img/in-post/graph_fund/ex_graph.jpg){: width="50%"}

例如，上图的临近矩阵可以表示为，

$$

\textbf{A} = 
\begin{pmatrix}

0 & 1 & 0 & 0 & 0 & 0 \\
1 & 0 & 1 & 0 & 0 & 0 \\
0 & 1 & 0 & 1 & 1 & 1 \\
0 & 0 & 1 & 0 & 0 & 1 \\
0 & 0 & 1 & 0 & 0 & 1 \\
0 & 0 & 1 & 1 & 1 & 0

\end{pmatrix}

$$

## 度 (Degree)

在一个图中，节点 $v_i \in \mathcal{V}$ 的度为与其相关联的边的数目。通过邻接矩阵计算：

$$
d(v_i) = \sum_{j=1}^N a_{i,j}
$$

### 邻域 (Neighborhood)

节点 $v_i$ 的邻域 $\mathcal{N}(v_i)$ 是所有与其相连的节点的集合。邻域中元素的个数与该节点的度相等，即 $d(v_i) = \|\mathcal{N}(v_i)\|$。



## 连通度 (Connectivity)

### 途径 (Walk)

途径是由节点和边组成的交替序列。

### 轨迹 (Trail)

边各不相同的途径。

### 路径 (Path)

节点各不相同的途径。

一条路径一定也是一条轨迹，一条轨迹一定也是一个途径。

### 环 (Cycle)

环是一条只有第一个节点和最后一个节点重复的途径。

### 子图 (Subgraph)

若图 $\mathcal{G}'$ 的节点集和边集分别为 图 $\mathcal{G}$ 的节点集和边集的子集，则 $\mathcal{G}'$ 为 $\mathcal{G}$ 的子图。

### 连通图 (Connected Graph)

在一个图中，若节点 $v_1$ 和节点 $v_2$ 之间有路径，则称 $v_1$ 和 $v_2$ 是连通的。若图中的任意一对节点均为连通的，则该图是一个连通图。

### 连通分量 (Connected Component)

图 $\mathcal{G} = \\{\mathcal{V}, \mathcal{E}\\}$ 的极大连通子图为 $\mathcal{G}$ 的连通分量。也就是说，假设该连通分量为 $\mathcal{G}' = \\{\mathcal{V}', \mathcal{E}'\\}$ ，$\mathcal{V} - \mathcal{V}'$ 中的节点不与任何 $\mathcal{V}'$ 的节点相连。

任何连通图中只有一个连通分量。

### 距离 (Distance)

两个节点之间最短路径的长度。最短路径可能由多条。

### 直径 (Diameter)

一个图的直径为在所有任意两个节点之间的最短路径中的最长的路径。

## 一些特殊的图

### 完全图 (Complete Graph)

完全图的每一对顶点都只有一条边相连。一个有 $n$ 个节点的完全图可以被记作 $K_n$ 。例如，$K_6$ 可以表示为，

![](/img/in-post/graph_fund/k6.jpg){: width="30%"}

### 循环图 (Cycle Graph)

循环图是由一个单环组成的图。一个有$n$个节点的循环图可以被记作 $C_n$ 。例如，$C_6$ 可以表示为，

![](/img/in-post/graph_fund/c6.jpg){: width="30%"}

### 二分图 (Bipartite Graph)

如果一个图里的所有节点可以被分成两个不相交的集合 $V_1, V_2$ ，使得图中的每一条边都连接了一个 $V_1$ 中的点和一个 $V_2$ 中的点，那么这个图是一个二分图。下图为一个二分图的例子。如果 $V_1$ 中的每个节点都与 $V_2$ 中的每个节点相连，那么这个图为完全二分图。

![](/img/in-post/graph_fund/b6.jpg){: width="30%"}




