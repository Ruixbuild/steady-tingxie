-- revision_seed_p4.sql
-- APPLY MANUALLY in Supabase SQL Editor, after revision_schema.sql.
-- Seeds P4 huanlehuoban-2025 chapters 1 (一起看电视) and 10 (这样才对) —
-- the two chapters transcribed from the source CSV so far. Re-running this
-- file is safe: the unique(primary_level, edition, chapter_number, sort)
-- constraint makes the insert idempotent via on conflict do nothing.
--
-- Note on row 5 (预测): the source CSV's sentence_2/pairing columns for
-- this row read oddly (sentence_2 holds "天气预报", which looks like it
-- belongs to 预报 in row 4, not 预测) — transcribed faithfully as-is rather
-- than silently corrected. Worth checking against the original worksheet.

insert into revision_vocab
  (primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4)
values
  ('P4','huanlehuoban-2025',1,'一起看电视',1,'新闻','xīn wén','news','write',false,'报纸、广播电台、电视台对新近发生的事情的报道。','爸爸一边吃早餐，一边看着报纸上的新闻。','电视台今天早上报道的新闻太轰动了，国人都议论纷纷。','新闻节目','新闻记者','新闻广播','阅读新闻'),
  ('P4','huanlehuoban-2025',1,'一起看电视',2,'了解','liǎo jiě','understand','read',true,'明白；清楚。','张主任刚上任不久，对工厂的情况还不了解。','妈妈经常和张老师联系，了解我在学校的学习情况。','了解事情','了解情况','无法了解',null),
  ('P4','huanlehuoban-2025',1,'一起看电视',3,'内外','nèi wài','inside and outside','both',false,'内部和外部；里面和外面。','这个地区出产的椰子味道鲜甜，远销国内外。','本次会议十分隆重，邀请了国内外著名的学者出席。','内外勾结','国家内外',null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',4,'预报','yù bào','forecast','read',false,'先报告；预先告知。','天气预报说明天有雨，所以我们取消了出游的计划。','我忘记看天气预报，不知道明天是阴天还是晴天。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',5,'预测','yù cè','predict / forecast','read',false,'预先推测。','今年端午龙舟竞赛，每一队都势力相当，谁能夺得冠军目前真无法预测。','天气预报','地震预报','气象预报',null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',6,'全岛','quán dǎo','whole island','write',false,'整个岛。','看电视台的新闻报告，我们可以知道全岛发生的事情。','经过多年的努力，全岛都种满了树，到处一片绿色。','全岛情况','传遍全岛',null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',7,'情况','qíng kuàng','situation','read',false,'情形；形势；状况。','这名病人的情况不好，医生不让他出院。','妈妈一见到我就问我今天考试的情况。','天气情况','了解情况','问起情况','考试情况'),
  ('P4','huanlehuoban-2025',1,'一起看电视',8,'观众','guān zhòng','spectator; audience','both',false,'观看表演或观看比赛的人。','爷爷喜欢看军事报道，是军事频道的忠实观众。','舞蹈家柔美的舞姿，博得观众的阵阵掌声。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',9,'播放','bō fàng','broadcast','read',false,'通过广播或电视放送音响或影像。','电视里正在播放足球比赛，爸爸目不转睛地看着。','爷爷闭目坐在院子里，听着电台播放的民间乐曲。','播放音乐','播放唱片','播放视频','播放比赛'),
  ('P4','huanlehuoban-2025',1,'一起看电视',10,'连续剧','lián xù jù','soap opera','read',false,'分若干集，情节连贯的戏剧、影视等。','大家围绕在一起，讨论昨天电视台播放的连续剧。','这部连续剧共有五十集，要播放几个月才能播完。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',11,'共','gòng','altogether','write',false,'表示合在一起；一共；总计。','这本书共收小说十五篇。','这部电视连续剧共有五十集。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',12,'集','jí','quantifier','read',false,'量词。用在较长影视段落。如：这部连续剧共有三十集。','这部连续剧共有一百多集，妈妈花了两个月从头看到尾。','这本小说很流行，片商有意把它拍成几十集的连续剧。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',13,'精彩','jīng cǎi','exciting; brilliant','both',false,'（表演、展览、言论、文章等）优美、出色。','今天的比赛竞争激烈，十分精彩。','台上演员的表演很精彩，获得台下热烈的掌声。','精彩节目','球赛精彩','故事精彩','节目精彩'),
  ('P4','huanlehuoban-2025',1,'一起看电视',14,'换成','huàn chéng','change','read',false,'事物的一种形式或内容变换为另一种。','你把他的黄色球衣换成蓝色的，他肯定不要！','你把他的名牌球鞋换成这种普通的胶鞋，他哪里肯接受？',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',15,'方言','fāng yán','dialect','read',false,'地方的语言。','虽然是在同一个国家，但各地区的方言却千差万别。','在写作文时，我们要避免使用方言，尽量使用规范的语言。','方言戏剧','地方方言','古老方言',null),
  ('P4','huanlehuoban-2025',1,'一起看电视',16,'忍不住','rěn bu zhù','cannot help (doing something)','write',false,'控制不住了。','妹妹跌倒了，痛得她忍不住哭了起来。','妈妈看弟弟不听话，忍不住骂了他几句。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',17,'投篮','tóu lán','shoot at the basket','read',false,'打篮球时向球架上的铁圈投球。','李大明的篮球打得真棒，投篮每投必中。','林文强是学校篮球队队长，他投篮几乎是百发百中。','投篮不中','投篮得分','瞄准投篮',null),
  ('P4','huanlehuoban-2025',1,'一起看电视',18,'手掌','shǒu zhǎng','palm','read',false,'人手的手指基部与腕部之间稍凹的部分。','演唱会的场面十分火爆，许多人把手掌都拍红了。','小朋友看了表演，个个高兴得拍着手掌。','拍着手掌',null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',19,'刚','gāng','just; only a short while ago','write',false,'表示行动或情况发生在不久以前。','天刚亮，妈妈就起床了。','哥哥在家，他刚从学校回来。',null,null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',20,'疲倦','pí juàn','exhausted','read',false,'疲乏；疲劳；困倦。','他确实太疲倦了，一躺在沙发上便睡着了。','我做了一整天的工，感到很疲倦。','感到疲倦','十分疲倦','身体疲倦',null),
  ('P4','huanlehuoban-2025',1,'一起看电视',21,'建议','jiàn yì','suggest','both',true,'向人提出自己的主张。','大强建议去图书馆看书，大家都表示赞成。','假期的露营活动，老师要同学们提出建议。','提出建议','合理建议','接受建议',null),
  ('P4','huanlehuoban-2025',1,'一起看电视',22,'舞蹈','wǔ dǎo','dance','both',false,'以有节奏的动作为表现手段的艺术形式，一般用音乐伴奏。','这种舞蹈节奏太快，不适合老人参加。','我不会跳舞，但我喜欢看舞蹈表演。','舞蹈表演',null,null,null),
  ('P4','huanlehuoban-2025',1,'一起看电视',23,'秘密','mì mì','secret','both',false,'有所隐藏，不让人知道的事情。','小华把我拉过一旁，说有个秘密要告诉我。','这是秘密，你千万别说出去。','秘密会议',null,null,null),

  ('P4','huanlehuoban-2025',10,'这样才对',1,'清洁工人','qīng jié gōng rén','street cleaner','write',false,'打扫街道的工人。','清洁工人在路边辛勤地打扫马路。','清洁工人在公园里打扫地上的落叶。',null,null,null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',2,'耐烦','nài fán','patient','both',false,'不急躁；不怕麻烦；不厌烦。','你才等了几分钟，怎么就这么不耐烦了？','他的话没完没了，使人听得很不耐烦。','很不耐烦',null,null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',3,'螃蟹','páng xiè','crab','read',false,'一种节肢动物。全身有甲壳，有五对足，前面一对足长成钳状，肉可食。','爸爸爱吃螃蟹，尤其爱吃清蒸螃蟹。','退潮后，浅滩上出现许多小螃蟹在觅食。','螃蟹米粉','辣椒螃蟹','清蒸螃蟹',null),
  ('P4','huanlehuoban-2025',10,'这样才对',4,'米粉','mǐ fěn','rice vermicelli','both',false,'一种食品。用大米磨浆制成。','妈妈今天炒的螃蟹米粉，味道好极了。','我们一家人去熟食中心吃东西，我叫了一碗米粉汤。','螃蟹米粉','肉丝米粉',null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',5,'不管','bù guǎn','no matter (what, how, etc)','write',true,'表示条件不同而结果不变；不论；无论。','不管我怎么说，他就是不答应！','不管多辛苦，我一定要完成这件事。','不管困难','不管怎么','不管怎样','不管是谁'),
  ('P4','huanlehuoban-2025',10,'这样才对',6,'帮助','bāng zhù','help','write',false,'帮忙别人做事或解决困难。','我们要帮助低年级的同学。','邻居有困难，我们一定要尽力帮助。','帮助老人','应该帮助','互相帮助','尽力帮助'),
  ('P4','huanlehuoban-2025',10,'这样才对',7,'礼貌','lǐ mào','courtesy','both',false,'对人恭敬，讲求礼节的表现。','小宝是一个很有礼貌的好孩子。','我们对人说话要有礼貌。','礼貌待人','懂得礼貌','很有礼貌','不懂礼貌'),
  ('P4','huanlehuoban-2025',10,'这样才对',8,'无礼','wú lǐ','have no manners; be disrespectful','both',false,'没有礼貌。','王伯伯是长辈，你不应该对他无礼。','你这样大声对李婆婆说话，真是无礼。','不应无礼','不该无礼','太过无礼','说话无礼'),
  ('P4','huanlehuoban-2025',10,'这样才对',9,'占','zhàn','occupy','both',false,'用强力取得；占据。','弟弟在小贩中心要用书包占位子，被我阻止了。','公园的位子是公用的，先到先坐，谁也不准占位。','占位','占据','占有','占领'),
  ('P4','huanlehuoban-2025',10,'这样才对',10,'玩耍','wán shuǎ','play','write',false,'做使自己精神愉快的活动；游戏。','同学们在草场上玩耍，不时发出欢笑声。','我家的小狗很调皮，又很好玩，天天要我和它玩耍。','同学玩耍','一起玩耍','不可玩耍','喜欢玩耍'),
  ('P4','huanlehuoban-2025',10,'这样才对',11,'柜子','guì zi','cupboard','read',false,'收藏衣物等东西用的器具，方形或长方形，一般用木或铁制成。','我放衣服的柜子很乱，妈妈要我自己收拾。','我房间放书本的柜子是爸爸亲手做的。','摆好柜子','整理柜子','移动柜子',null),
  ('P4','huanlehuoban-2025',10,'这样才对',12,'水壶','shuǐ hú','bottle','read',false,'盛水的容器。','妈妈煮了开水后，便把水倒入水壶里。','弟弟要我帮他把水壶装满水。','打翻水壶',null,null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',13,'洒','sǎ','spill','both',false,'（水或其他东西）分散地落下。','水壶被弟弟打翻了，水洒了一地。','在走廊扫地之前要先洒一些水，避免尘土飞扬。',null,null,null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',14,'拖把','tuō bǎ','mop','read',false,'一种扫地板的工具。用许多布条或细绳固定在长棍的一头做成。','我去向校工借拖把，要把课室地面的水扫干净。','家里的拖把坏了，暂时无法拖地板。','借用拖把',null,null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',15,'推开','tuī kāi','push open','write',false,'向前出力使关着的东西不再关着。','我推开大门，便看见爸爸坐在沙发上看报纸。','这铁门又大又重，我用尽力量才把它推开。','推开大门','用力推开','大力推开',null),
  ('P4','huanlehuoban-2025',10,'这样才对',16,'喊','hǎn','shout','both',false,'大声叫。','你这样又喊又叫，会吵到别人。','我走在小路上，忽然听到有人在喊：“救命呀！救命呀！”',null,null,null,null),
  ('P4','huanlehuoban-2025',10,'这样才对',17,'理睬','lǐ cǎi','pay attention to','both',false,'对别人的言语，行动表示态度；理会；答理。','虽然他一直找机会要跟我说话，可是我不理睬他。','自从吵了架以后，他们两人谁也不理睬谁了。','没有理睬','没人理睬','不加理睬','互不理睬'),
  ('P4','huanlehuoban-2025',10,'这样才对',18,'不肯','bù kěn','unwilling','both',false,'不愿意；不乐意。','我向大明借橡皮，他不肯借给我。','大明很自私，不肯借科学笔记给我。','不肯借出','不肯答应','不肯接受',null),
  ('P4','huanlehuoban-2025',10,'这样才对',19,'敲门','qiāo mén','knock on the door','read',false,'击打房门使发出声音。','有人敲门，你去看看是谁来了。','我不停地敲门，可是没有人来开门。','轻轻敲门','大力敲门','有人敲门',null),
  ('P4','huanlehuoban-2025',10,'这样才对',20,'害羞','hài xiū','be shy','read',false,'感到不好意思；难为情。','她乱说话，老师看了她一眼，她立刻害羞地低下头。','她第一次上台表演，显得有点害羞。','害羞脸红','显得害羞','很是害羞','十分害羞'),
  ('P4','huanlehuoban-2025',10,'这样才对',21,'显得','xiǎn de','look; show','both',false,'表现出来的某种情形。','小丽今天显得特别开心，不知道有什么喜事。','他家里最近发生了一些不如意的事，所以显得闷闷不乐。','显得害羞','显得高兴','显得忧愁',null)
on conflict (primary_level, edition, chapter_number, sort) do nothing;
