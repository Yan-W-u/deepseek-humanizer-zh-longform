# deepseek-humanizer-zh-longform

给中文长文去 AI 味的两个 Skill，主要面向长篇小说。单文件，零依赖，装进任何支持 Agent Skills 的编辑器就能用。

## 装哪个

仓库里有两个 Skill：

| Skill | 对症 | 安装 |
|---|---|---|
| `deepseek-humanizer-zh-longform` | DeepSeek 特化：逗号碎句、对称排比、无关信息金句化、规训腔、留白腔 | `npx skills add Yan-W-u/deepseek-humanizer-zh-longform --skill deepseek-humanizer-zh-longform -g` |
| `deep-ai-feel-skill` | 通用体检：五类 AI 结构习惯 + 改写 | `npx skills add Yan-W-u/deepseek-humanizer-zh-longform --skill deep-ai-feel-skill -g` |

两个一起装：

    npx skills add Yan-W-u/deepseek-humanizer-zh-longform --all -g

也可以手动把对应目录里的 SKILL.md 放进工具的 skills 目录。

## DeepSeek 特化版对症哪几条

DeepSeek 写中文长文，第一眼认出来的是短：句子短、分句短，短得没有理由。它把断句当成了有文采的默认手段，于是不重要的信息也配上金句的乐。

| 编号 | 症状 | 例子 |
|---|---|---|
| DS1 | 逗号碎句，一段切出好几个短块 | 他走进屋子，点亮灯，坐下。 |
| DS2 | 对称排比癖，三项同质只为好听 | 自己的穹顶，自己的煤，自己的光 |
| DS3 | 把背景设定写成警句 | 灯亮，抽水机转。不多不少，就这么多。 |
| DS4 | 留白腔，用"不必多言"代替克制 | 这就够了。 |
| DS5 | 廉价抒情，用"说不清"假装含蓄 | 心里涌上一阵说不清的滋味 |
| DS6 | 万能缓冲词 | 仿佛、似乎、某种、一丝、静静、缓缓 |
| DS7 | 规训腔，先立个错做法再宣布对的 | 他要做的不是逃，是留下。 |

一句判据：把碎句连起来说，意思少了没有？没少，断句就是装饰。

## 通用版管什么

| 组 | 管什么 |
|---|---|
| A 说而不是演 | 情绪直述、心理旁白、替读者总结动机、段尾升华 |
| B 修饰膨胀 | 形容词三连、程度副词、比喻滥用与复用、四字格排比、宏大意象 |
| C 节奏句式 | 句长均匀、排比三连、对称对比句、"的"字堆叠、逗号碎句 |
| D 结构模板 | 段落等长、开场景描套路、对话过度功能化、破折号滥用、重复铺陈 |
| E 残留痕迹 | 助手腔、说明文腔、自我叙述 |

## 用法

两种模式。改写是默认的。

    /deepseek-humanizer-zh-longform 润色这段
    /deepseek-humanizer-zh-longform 把 第三章.md 的 AI 味去掉
    /deepseek-humanizer-zh-longform 检测这篇的 AI 痕迹

检测模式出一张表，逐条列出命中的规则、原文片段、严重度，再给五个维度打分：具体性、节奏、克制、信息密度、声音，满分 50。

40 分以上基本是人的稿。25 到 39 分是混合稿，得逐条改。低于 25 分，典型 AI 腔。

## 两条底线

一，动的是讲法。人物、事件、因果、设定、时间线，一个都不动。

二，感官和动作细节可以往上补，人物关系、事件、因果这些不能加。把"她很害怕"改成她攥紧门框、听见自己吞口水的声音，行。给她添个弟弟，不行。

还有一条容易被忽略：把句子改短当去味，是最常见的翻车。句句求短、句句留白，读起来照样假。

## 不适用的情况

引文、人物故意这么说的台词、方言、信件奏折这类文中文体，不动。

网文的爽点和章末钩子是体裁约定，不是 AI 味，别删。

2022 年 11 月之前的旧稿不是 AI 写的。

## 来源

结构取自维基百科 Signs of AI writing 页面和 WikiProject AI Cleanup 团队的整理，参考了 blader/humanizer 与 op7418/Humanizer-zh 的公开做法，规则表按中文长文的叙事特点重写。

MIT 协议。
