#!/usr/bin/env python3
import json
import sys
import os
import shutil
import spacy

import en_core_web_sm 
import zh_core_web_sm
from spacy import displacy

HERE = os.path.dirname(os.path.realpath(__file__))
LANG = "en"

if LANG == "en":
    nlp = spacy.load("en_core_web_sm")  # type: ignore
    nlp = en_core_web_sm.load()
elif LANG == "ch":
    nlp = spacy.load("zh_core_web_sm")  # type: ignore
    nlp = zh_core_web_sm.load()


def get_noun_chunks_zh(doc):
    """Extract noun phrases using dependency relations."""
    chunks = []
    for token in doc:
        if token.dep_ in (
            "nsubj",
            "dobj",
            "nmod",
            "compound",
            "ROOT",
        ) and token.pos_ in ("NOUN", "PROPN"):
            start = token.i
            end = token.i + 1
            for child in token.children:
                if child.dep_ in ("compound", "nmod", "amod", "nummod"):
                    start = min(start, child.i)
                    end = max(end, child.i + 1)
            chunks.append(doc[start:end])
    return chunks


def get_phrase_data(doc):
    token_to_chunk = {}
    try:
        for chunk in doc.noun_chunks:
            for token in chunk:
                token_to_chunk[token.i] = chunk
    except NotImplementedError:
        token_to_chunk = get_noun_chunks_zh(doc)

    phrases = []
    visited = set()

    for token in doc:
        if token.i in token_to_chunk:
            chunk = token_to_chunk[token.i]
            if chunk.start not in visited:
                visited.add(chunk.start)
                root = chunk.root
                phrases.append(
                    {
                        "word": chunk.text,
                        "norm": root.norm_,
                        "pos": root.pos_,
                        "id": chunk.start,
                        "dep": root.dep_,
                        "head_id": root.head.i,
                        "is_phrase": True,
                        "span": [chunk.start, chunk.end],  # token range
                    }
                )
        else:
            # Non-noun tokens (verbs, conjunctions, etc.) cannot be "phrased"
            phrases.append(
                {
                    "word": token.text,
                    "norm": token.norm_,
                    "pos": token.pos_,
                    "id": token.i,
                    "dep": token.dep_,
                    "head_id": token.head.i,
                    "is_phrase": False,
                    "span": [token.i, token.i + 1],
                }
            )

    return phrases


def main():
    if LANG == "en":
        lines = [
            "I. I saw the best minds of my generation destroyed by. madness, starving hysterical naked,. dragging themselves through the negro streets at dawn. looking for an angry fix,. angelheaded hipsters burning for the ancient heavenly. connection to the starry dynamo in the machin-. ery of night,. who poverty and tatters and hollow-eyed and high sat. up smoking in the supernatural darkness of. cold-water flats floating across the tops of cities. contemplating jazz,. who bared their brains to Heaven under the El and. saw Mohammedan angels staggering on tene-. ment roofs illuminated,. who passed through universities with radiant cool eyes. hallucinating Arkansas and Blake-light tragedy. among the scholars of war,. who were expelled from the academies for crazy &amp. publishing obscene odes on the windows of the. skull,. who cowered in unshaven rooms in underwear, burn-. ing their money in wastebaskets and listening. to the Terror through the wall,. who got busted in their pubic beards returning through. Laredo with a belt of marijuana for New York,. who ate fire in paint hotels or drank turpentine in. Paradise Alley, death, or purgatoried their. torsos night after night. with dreams, with drugs, with waking nightmares, al-. cohol and cock and endless balls,",
            "There is another sky, Ever serene and fair, And there is another sunshine, Though it be darkness there Never mind faded forests, Austin, Never mind silent fields - Here is a little forest, Whose leaf is ever green Here is a brighter garden, Where not a frost has been In its unfading flowers I hear the bright bee hum: Prithee, my brother, Into my garden come!",
        ]
    elif LANG == "ch":
        lines = [
            "在属于历史的天空盘旋。保持着时间和空间的距离。既没有狂喜也没有悲哀。低下头。底下是一块杀伐的土地。以如今已沈埋的铜戈铁戟。以不须眨眼即至的枪炮子弹。以猝不及防的流言与蜚语。以相沿成习的斗争与贬谪。以冷感与冷漠。刺穿多少人的胸膛与心灵。在属于历史的天空盘旋。保持着避免伤感的距离。一千英里以下的真实。只能透过窗口的云雾去看。只能透过一帧帧刻意经营的旅游图片去看。只能透过诗词歌赋去看。那盛唐的乌托邦。在语义暧味的文化史里酿造着。在落地之前。视网膜残留的山川幻影。应不应该扫除。是不是及时。给自己以充分的鼓舞。全看海关人员的脸色而定。全看机场外野鸡车司机的良心而定。全看城里有多少勒索的窥伺而定。至于地下的考古挖掘。与夫地上的城池楼阁。就留给蜂拥而至的观光客。糟蹋去吧",
            "冬天了，广州并不冷。在铸山村，我的家乡。红花草的种子在另一个世界苏醒。春天绽放于它们的躯干。越贫寒越美丽。来年在我的世界。一群人踩过遍地紫色幼花。穿越两公里时空进入学堂。他们在红花草的身体上。精确犁出一条供两人并肩的路。并适时摆开战局。一群人分成两组。有人把一块泥团准确地投到我脸上。战争才真正开始。双方扭打如两队哺乳期的小黄牛。已经过去很久了。有人坐在电脑前，敲打着键盘。有人已魂归西天，带着伙伴们未了的梦。春天走得缓慢，却来得匆忙。城市的大街小巷容不下一朵紫花的微笑。我在来年的春天里。只能把脚掌铆在坚硬的地板上。家乡的红花草长势茂盛，寂寞逼人。在它们的记忆中。再也没有谁比得上一条穿梭的蚯蚓。我的那些孩子们已经杳无踪迹",
            "雪落在中国的土地上，。寒冷在封锁着中国呀……。风，。像一个太悲哀了的老妇。紧紧地跟随着。伸出寒冷的指爪。拉扯着行人的衣襟，。用着你土地一样古老的。一刻也不停地絮聒着……。那从林间出现的，。赶着马车的。你中国的农夫，。戴着皮帽，。冒着大雪。要到哪儿去呢？。告诉你。我也是农人的后裔——。由于你们的。刻满了痫苦的皱纹的脸。我能如此深深地。知道了。生活在草原上的人们的。岁月的艰辛。。而我。也并不比你们快乐啊。——躺在时间的河流上。苦难的浪涛。曾经几次把我吞没而又卷起——。流浪与监禁。已失去了我的青春的最可贵的日子，。我的生命。也像你们的生命。一样的憔悴呀。。雪落在中国的土地上，。寒冷在封锁着中国呀……。沿着雪夜的河流，。一盏小油灯在徐缓地移行，。那破烂的乌篷船里。映着灯光，垂着头。坐着的是谁呀？。——啊，你。蓬发垢面的小妇，。是不是。你的家。——那幸福与温暖的巢穴。已枝暴戾的敌人。烧毁了么？。是不是。也像这样的夜间，。失去了男人的保护，。在死亡的恐怖里",
        ]
    else:
        lines = ""
        print("to be implemented, check LANG setting.")
        sys.exit()

    result = []
    for line in lines:
        doc_en = nlp(line)
        result.append(get_phrase_data(doc_en))

    filename = f"tokens_{LANG}.json"
    output_path = os.path.join("output", filename)
    destination = os.path.join(os.path.dirname(HERE), "web", "data")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    shutil.copy(output_path, destination)
    print("Data copied to ", os.path.join(destination, filename))


if __name__ == "__main__":
    main()
    print("done.")
