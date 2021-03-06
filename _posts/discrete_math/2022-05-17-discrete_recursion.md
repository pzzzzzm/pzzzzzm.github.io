---
layout: post
title: "高级点的离散数学（一）：递归"
subtitle: "Advanced Discrete Math #1: Recursion"
date: 2022-05-17
author: "BeanPudding"
header-img: "img/post-math.jpg"
tags: 
    - 离散数学
    # - 系列
---

# 递归 (Recursion)

递归是指函数在定义中调用了其自身的方法。例如，$a^n$可以用以下递归的形式来表示：

$$
a^n = a \times a^{n-1}
$$

递归能将一些复杂且内部重复的问题通过简单的步骤。当然缺点也显而易见，从$a_0$一步一步计算到$a^n$明显要比直接计算$a^n$麻烦不少。但如果我们并不清楚问题的封闭式(Close-form formula)，就只能通过递归计算出目标的值。

递归大概分为三步：

1. Basis Step: 定义一个初始值 $f(0)$
2. Recursive Step: 定义从 $f(k)$ 计算出 $f(n)$ 的过程 $(k < n)$
3. 在实践中，我们也需要定义什么时候停止递归

接下来我会给出一些通过递归解决问题的例子。

## 斐波那契数列 (Fibonacci Sequence)

在斐波那契数列里，每一项等于前两项的和：

$$
1, 1, 2, 3, 5, 8, ...
$$


想找出这个数列的封闭式明显要难不少，但是通过递归就非常简单。

Basis Step:
$$
F_0 = 0, F_1 = 1
$$

Recursive Step:
$$
F_n = F_{n-1} + F_{n-2}
$$
where $n \ge 2$.

这里也给出斐波那契数列的通项公式 (主要是为了试试用markdown写公式)，

$$
F_n = \frac{1}{\sqrt{5}}((\frac{1+\sqrt{5}}{2})^n-(\frac{1-\sqrt{5}}{2})^n)
$$

## 河内塔 (Tower of Hanoi)

> 有三根杆子A，B，C。 A杆上有N个 $(N>1)$ 穿孔圆盘，盘的尺寸由下到上依次变小。要求按下列规则将所有圆盘移至 C 杆：
1.每次只能移动一个圆盘；
2.大盘不能叠在小盘上面。
请问：如何移？最少要移动多少次？

以上就是著名的河内塔问题。这个问题也可以用递归解决。问题在于，怎么将它转化为递归形式。

![](/img/in-post/discrete_math/recursion_hanoi.png "Tower of Hanoi")

先在脑补一下前几步。当移动第三个圆盘时，前两个圆盘必须叠在一个杆子上。如果想继续移动第四个，则必须把前三个叠在一起。而在此之前，我们已经成功的把前两个叠到了一起，只需要再按照相同的步骤把这两个挪到第三个上。

![](/img/in-post/discrete_math/recursion_hanoi2.jpg "Step for N")

由此，我们可以说，在移动第$N$个圆盘前，我们需要已经成功的移动了前$N-1$个圆盘。而对与第$N+1$个，因为它比前面的圆盘都大，我们可以在这一步暂时忽略它。在下一步，也就是移动第$N+1$个圆盘之前，我们要先把前$N-1$个圆盘移到第$N$个圆盘上，给第$N+1$个圆盘腾出空来。当我们移动完，实际上我们已经成功的移动了$N$个圆盘。

根据上面的思路，我们可以开始构建这个递归了。假设第一根杆子上有$n$个圆盘，

Basis Step:
$$
T_1 = 1
$$

Recursive Step:
$$
\begin{align}
T_n &= T_{n-1} + 1 + T_{n-1} \\
&= 2T_{n-1} + 1
\end{align}
$$
where $n \ge 2$.

## 约瑟夫问题 (Josephus Problem)

> 人们站在一个等待被处决的圈子里。 计数从圆圈中的指定点开始，并沿指定方向围绕圆圈进行。 在跳过指定数量的人之后，处刑下一个人。 对剩下的人重复该过程，从下一个人开始，朝同一方向跳过相同数量的人，直到只剩下一个人，并被释放。

![](/img/in-post/discrete_math/recursion_josephus.png){: width="50%"}


我们假设一共有$n$人，每次跳过$k$个人。当$n = 10, k = 1$时，被处决的人的顺序为: $2, 4, 6, 8, 10, 3, 7, 1, 9$。此时活下来的人的序号为$5$，我们可以说，

$$
J(10, 1) = 5
$$

约瑟夫问题的解决方法有很多，这里提供两种思路。

第一种是以一圈为一步进行递归。在$k = 1$的情况下，当圈里的总人数为偶数时，所有序号为偶数的人会被处决。进行下一轮时，所有剩下的人会被重新排序，

$$
\begin{align}
1 &\rightarrow 1 \\
3 &\rightarrow 2 \\
5 &\rightarrow 3 \\
&... \\
n &\rightarrow \frac{n+1}{2}
\end{align}
$$

此时，剩下的人数为总人数的一半。最后存活下来的那个人我序号在这两步之间的关系则为，

$$
J(2n, 1) = 2J(n, 1) - 1
$$

当圈里的人数为奇数时，在所有偶数序号的人被处决后，第一个人也会被处决。再次重新排序，

$$
\begin{align}
3 &\rightarrow 1 \\
5 &\rightarrow 2 \\
7 &\rightarrow 3 \\
&... \\
n &\rightarrow \frac{n-1}{2}
\end{align}
$$

此时，剩下的人数为总人数一半减一（因为第一个人也被处决了）。最后存活下来的那个人我序号在这两步之间的关系为，

$$
J(2n+1, 1) = 2J(n, 1)+1
$$

第一种方法更像是针对$k=1$时的特解。还有一种方法更加泛化，每一步递归也更加简单。

同样是当$n = 10, k = 1$时，第二个人被处决了，此时，我们直接对剩下的人重新排序，但我们把第三个人放到第一个位置，因为下一次被处决的人将是第三个人之后的人。

![](/img/in-post/discrete_math/recursion_josephus2.png){: width="90%"}

剩下的人形成了一个总人数为$n-1$的新圈。也就是说，除了第一个人以外，其他人的序号在这两步之间的关系为，

$$
J(n, 1) = J(n-1, 1) + 2
$$

对于第一个人，我们可以通过$\bmod$ 来进行处理，

$$
J(n, 1) = ((J(n-1, 1) + 1) \bmod n) + 1
$$

如果是从0开始排序，上述式子能更加简化。通过这个思路，我们可以继续推导出，当我们每次跳过$k$人时，

$$
J(n, k) = ((J(n-1, k) + k)\bmod n) + 1
$$

这种方法看起来更符合递归步骤简洁的特点，但代价就是，在实际的运行中需要的步骤可能会更多，计算时间更长。这将涉及到***时间复杂度***的概念。
