---
layout: post
title: "高级点的离散数学：闭式解"
subtitle: "Advanced Discrete Math: Closed form Expression"
date: 2022-06-21
author: "BeanPudding"
header-img: "img/post-math.jpg"
tags: 
    - 离散数学
    - 系列
---

# 闭式解 (Closed-form Expression)

闭式解也叫解析解，是指可以用解析表达式来表达的解。以上一节提到的[河内塔]({% post_url discrete_math/2022-05-17-discrete_recursion %}/#河内塔-tower-of-hanoi)问题为例，当有$n$个圆盘时，它所需要的步骤数为，

$$
T(n) = \left\{
\begin{align}
    & 1 & & n=1 \\
    & 2T(n-1) + 1 & & n \ge 2
\end{align}
\right.
$$

我们列出前几项的解，

$$
1, 3, 7, 15, 31, 63, ...
$$

不难发现这串数字是有规律可循的，

$$
T(n) = 2^n-1
$$

通过数学归纳法，我们可以快速的验证它。

> 当$n=1$时，$1 = 2^1-1$, 式子成立。
>
> 假设$n=k$时式子成立，
>
>$$
T(k) = 2^k-1
>$$
>
>当$n=k+1$时，
>
>$$
\begin{align}
T(k+1) & =  2(T(k))+1 \\
& = 2(2^k-1)+1 \\
& = 2^{k+1} -1
\end{align}
>$$
>
>式子成立。

通过闭式解，我们可以在很快的时间内计算出解。但是有时闭式解并不能直接被观察出来，接下来我们会介绍一种找出闭式解的方法。

## Repertoire方法

假设$B_n=n^2$, 我们可以得到$B_n$和$B_{n-1}$的关系，

$$
\begin{align}
B_n & = B_n + B_{n-1} - B_{n-1} \\
& = B_{n-1} + n^2 - (n-1)^2 \\
& = B_{n-1} + 2n - 1
\end{align}
$$

同样的方法，我们可以得到,

$$
A_n = n = A_{n-1} + 1 \\
B_n = n^2 = B_{n-1} + 2n - 1 \\
C_n = n^3 = C_{n-1} + 3n^2 - 3n + 1 \\
...
$$

有了这些式子，我们可以去“拼”出问题的闭式解。

比如，我们想要找出$T_n = T_{n-1} + 2n^2 + 7$且$T_0 = 7$的闭式解。递归的式子中的最高次幂为$2$，上面得到的式子中最高次幂为$2$的是$C_n$，所以我们需要用$A_n, B_n, C_n$来构建这个解。

我们假设

$$
T_n = \gamma C_n + \beta B_n + \alpha A_n,
$$

根据之前得到式子，我们可以拓展它，

$$
\begin{align}

T_n &= \gamma C_n + \beta B_n + \alpha A_n \\
&=\gamma (C_{n-1} + 3n^2 - 3n + 1) + \beta B_n + \alpha A_n \\
&= \gamma C_n + \beta (B_{n-1} + 2n - 1) + \alpha (A_{n-1} + 1) \\
&= 3\gamma n^2 + (-3\gamma+2\beta)n + (\gamma - \beta + \alpha) + (\gamma C_{n-1} + \beta B_{n-1} + \alpha A_{n-1}) \\
&= 3\gamma n^2 + (-3\gamma+2\beta)n + (\gamma - \beta + \alpha) + T_{n-1}

\end{align}
$$

根据递归式，我们可以得出，

$$
3 \gamma = 2 \\
-3\gamma+2\beta = 0 \\ 
\gamma - \beta + \alpha = 7
$$

解上述方程，我们得到 $\gamma = \frac{2}{3}, \beta = 1, \alpha = \frac{22}{3}$， 所以，

$$
T_n = \frac{2}{3} n^3 + n^2 + \frac{22}{3}n
$$

但这并不是最终的结果，因为这个关系只考虑的递归的步骤，并没有考虑初始值， 也就是$T_0$。我们将$T_0$加在后面，

$$
T_n = \frac{2}{3} n^3 + n^2 + \frac{22}{3}n + 7
$$

这样我们就通过Repertoire方法解决了这个问题。