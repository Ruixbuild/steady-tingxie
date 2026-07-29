-- revision_seed_p5.sql
-- APPLY MANUALLY in Supabase SQL Editor, after revision_schema.sql.
-- Seeds P5 huanlehuoban-2025 chapters 1-2, transcribed from Vocab
-- List/P5_Vocab.csv. NOTE: as of this transcription, this file's content is
-- byte-for-byte identical to P4's chapters 1-2 (same words, same chapter
-- titles) -- confirmed with the user as a known placeholder, not a bug in
-- this transcription. Replace with real P5 content when available.
--
-- Re-running this file is safe: on conflict (primary_level, edition,
-- chapter_number, sort) it upserts (not just skips) so a later re-run
-- with corrected CSV data actually fixes previously-seeded rows too.

insert into revision_vocab
  (primary_level, edition, chapter_number, chapter_title, sort, hanzi, pinyin, english, skill, is_higher_chinese, cn_definition, sentence_1, sentence_2, pairing_1, pairing_2, pairing_3, pairing_4)
values
  ('P5','huanlehuoban-2025',1,'一起看电视',1,'新闻','xīn wén','news','write',false,'报纸、广播电台、电视台对新近发生的事情的报道。','爸爸一边吃早餐，一边看着报纸上的新闻。','电视台今天早上报道的新闻太轰动了，国人都议论纷纷。','新闻节目','新闻记者','新闻广播','阅读新闻'),
  ('P5','huanlehuoban-2025',1,'一起看电视',2,'了解','liǎo jiě','understand','read',true,'明白；清楚。','张主任刚上任不久，对工厂的情况还不了解。','妈妈经常和张老师联系，了解我在学校的学习情况。','了解事情','了解情况','无法了解',null),
  ('P5','huanlehuoban-2025',1,'一起看电视',3,'内外','nèi wài','inside and outside','both',false,'内部和外部；里面和外面。','这个地区出产的椰子味道鲜甜，远销国内外。','本次会议十分隆重，邀请了国内外著名的学者出席。','内外勾结','国家内外',null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',4,'预报','yù bào','forecast','read',false,'先报告；预先告知。','天气预报说明天有雨，所以我们取消了出游的计划。','我忘记看天气预报，不知道明天是阴天还是晴天。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',5,'预测','yù cè','predict / forecast','read',false,'预先推测。','今年端午龙舟竞赛，每一队都势力相当，谁能夺得冠军目前真无法预测。','','天气预报','地震预报','气象预报',null),
  ('P5','huanlehuoban-2025',1,'一起看电视',6,'全岛','quán dǎo','whole island','write',false,'整个岛。','看电视台的新闻报告，我们可以知道全岛发生的事情。','经过多年的努力，全岛都种满了树，到处一片绿色。','全岛情况','传遍全岛',null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',7,'情况','qíng kuàng','situation','read',false,'情形；形势；状况。','这名病人的情况不好，医生不让他出院。','妈妈一见到我就问我今天考试的情况。','天气情况','了解情况','问起情况','考试情况'),
  ('P5','huanlehuoban-2025',1,'一起看电视',8,'观众','guān zhòng','spectator; audience','both',false,'观看表演或观看比赛的人。','爷爷喜欢看军事报道，是军事频道的忠实观众。','舞蹈家柔美的舞姿，博得观众的阵阵掌声。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',9,'播放','bō fàng','broadcast','read',false,'通过广播或电视放送音响或影像。','电视里正在播放足球比赛，爸爸目不转睛地看着。','爷爷闭目坐在院子里，听着电台播放的民间乐曲。','播放音乐','播放唱片','播放视频','播放比赛'),
  ('P5','huanlehuoban-2025',1,'一起看电视',10,'连续剧','lián xù jù','soap opera','read',false,'分若干集，情节连贯的戏剧、影视等。','大家围绕在一起，讨论昨天电视台播放的连续剧。','这部连续剧共有五十集，要播放几个月才能播完。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',11,'共','gòng','altogether','write',false,'表示合在一起；一共；总计。','这本书共收小说十五篇。','这部电视连续剧共有五十集。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',12,'集','jí','quantifier','read',false,'量词。用在较长影视段落。如：这部连续剧共有三十集。','这部连续剧共有一百多集，妈妈花了两个月从头看到尾。','这本小说很流行，片商有意把它拍成几十集的连续剧。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',13,'精彩','jīng cǎi','exciting; brilliant','both',false,'（表演、展览、言论、文章等）优美、出色。','今天的比赛竞争激烈，十分精彩。','台上演员的表演很精彩，获得台下热烈的掌声。','精彩节目','球赛精彩','故事精彩','节目精彩'),
  ('P5','huanlehuoban-2025',1,'一起看电视',14,'换成','huàn chéng','change','read',false,'事物的一种形式或内容变换为另一种。','你把他的黄色球衣换成蓝色的，他肯定不要！','你把他的名牌球鞋换成这种普通的胶鞋，他哪里肯接受？',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',15,'方言','fāng yán','dialect','read',false,'地方的语言。','虽然是在同一个国家，但各地区的方言却千差万别。','在写作文时，我们要避免使用方言，尽量使用规范的语言。','方言戏剧','地方方言','古老方言',null),
  ('P5','huanlehuoban-2025',1,'一起看电视',16,'忍不住','rěn bu zhù','cannot help (doing something)','write',false,'控制不住了。','妹妹跌倒了，痛得她忍不住哭了起来。','妈妈看弟弟不听话，忍不住骂了他几句。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',17,'投篮','tóu lán','shoot at the basket','read',false,'打篮球时向球架上的铁圈投球。','李大明的篮球打得真棒，投篮每投必中。','林文强是学校篮球队队长，他投篮几乎是百发百中。','投篮不中','投篮得分','瞄准投篮',null),
  ('P5','huanlehuoban-2025',1,'一起看电视',18,'手掌','shǒu zhǎng','palm','read',false,'人手的手指基部与腕部之间稍凹的部分。','演唱会的场面十分火爆，许多人把手掌都拍红了。','小朋友看了表演，个个高兴得拍着手掌。','拍着手掌',null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',19,'刚','gāng','just; only a short while ago','write',false,'表示行动或情况发生在不久以前。','天刚亮，妈妈就起床了。','哥哥在家，他刚从学校回来。',null,null,null,null),
  ('P5','huanlehuoban-2025',1,'一起看电视',20,'疲倦','pí juàn','exhausted','read',false,'疲乏；疲劳；困倦。','他确实太疲倦了，一躺在沙发上便睡着了。','我做了一整天的工，感到很疲倦。','感到疲倦','十分疲倦','身体疲倦',null),
  ('P5','huanlehuoban-2025',1,'一起看电视',21,'建议','jiàn yì','suggest','both',true,'向人提出自己的主张。','大强建议去图书馆看书，大家都表示赞成。','假期的露营活动，老师要同学们提出建议。','提出建议','合理建议','接受建议',null),
  ('P5','huanlehuoban-2025',1,'一起看电视',22,'舞蹈','wǔ dǎo','dance','both',false,'以有节奏的动作为表现手段的艺术形式，一般用音乐伴奏。','这种舞蹈节奏太快，不适合老人参加。','我不会跳舞，但我喜欢看舞蹈表演。','舞蹈表演','看看舞蹈','欣赏舞蹈','观看舞蹈'),
  ('P5','huanlehuoban-2025',1,'一起看电视',23,'秘密','mì mì','secret','both',false,'有所隐藏，不让人知道的事情。','小华把我拉过一旁，说有个秘密要告诉我。','这是秘密，你千万别说出去。','秘密会议','秘密武器','秘密进行','秘密任务'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',1,'苹果','píng guǒ','apple','write',false,'一种常见水果，圆形，红色或青色。','妈妈今天买了一袋红苹果。','我们一家人都爱吃苹果。','吃着苹果','爱吃苹果',null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',2,'词语','cí yǔ','words and expressions','read',false,'词和短语；语言里最小的，可以运用的单位。','王小文很聪明，学过的词语都懂得灵活运用。','张小华在作文中运用了很多优美的词语，所以获得了高分。','词语手册','讨论词语','运用词语','使用词语'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',3,'鱼丸','yú wán','fish ball','write',false,'将鱼肉剁成碎末，加上调料而制成的食物。','这家小吃店卖的鱼丸很美味，每天都挤满了顾客。','弟弟吵着要吃鱼丸，妈妈只好买了一串给他吃。','一串鱼丸','烹饪鱼丸','制作鱼丸',null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',4,'小鼓','xiǎo gǔ','side drum','read',false,'可以背着表演的小的鼓。鼓：一种乐器，多为扁圆形，中间空，一面或两面蒙着皮。','哥哥喜欢玩乐器，最擅长击打小鼓。','这首歌曲很特别，因为里面融入了小鼓元素。','背着小鼓','打着小鼓','击着小鼓','击打小鼓'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',5,'帽子','mào zi','hat','read',false,'戴在头上的用品。','这顶帽子很大，不合我戴。','我生日那天，张阿姨送了我一顶花边帽子。','戴着帽子','尖形帽子','一顶帽子','戴上帽子'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',6,'外套','wài tào','jacket','read',false,'披在外面的西式短上衣；大衣。','爸爸穿在外套，要去赴宴。','哥哥买了一件蓝色的外套，十分好看。','披在外套','穿着外套','披上外套','穿在外套'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',7,'递','dì','pass','write',false,'由一方交给另一方；传送。','请你把桌上的书递给我。','李老师递给我一封信，要我把它交给王老师。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',8,'姑姑','gū gu','aunt (father''s sister)','write',false,'父亲的姐妹；姑母；姑妈。','姑姑很疼我们，经常给我们买衣服。','姑姑送我一个精美的文具盒。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',9,'烟花棒','yān huā bàng','sparkler','read',false,'一种供孩童玩、能放出烟花的小棍子。','几个小朋友在草地上玩烟花棒，不时发出欢乐的笑声。','明天就是新年了，弟弟要妈妈买烟花棒给他，说要庆祝新年。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',10,'乌云','wū yún','dark clouds; black clouds','write',false,'形容下雨前天上的黑云。','天上乌云密布，看来要下雨了。','天空突然飘来一团乌云，把太阳遮住了。','乌云密布','乌云滚滚','一团乌云','布满乌云'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',11,'紧接着','jǐn jiē zhe','after that','write',false,'表示后一个动作行为紧跟着前一个动作行为。','我和小华玩了排球，紧接着去食堂喝水。','我把拾到的钱包交给老师后，紧接着回课室上课。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',12,'倾盆大雨','qīng pén dà yǔ','downpour','read',false,'形容雨下得又大又急，就像用盒子往下倒水一样。','昨天夜里，突然下起了倾盆大雨，许多地区都积水了。','因为下了一场倾盆大雨，我只好待在家里，不出去玩了。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',13,'暖暖','nuǎn nuǎn','warm','write',false,'形容温暖。','外面天气很冷，我穿上暖暖的外套才出门。','暖暖的阳光从窗外照起来，房间顿时暖和起来。','外套暖暖','感到暖暖','穿得暖暖','觉得暖暖'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',14,'表示','biǎo shì','express; show; indicate','both',true,'事物本身或用某种事物显示出某种意义。','他点点头，表示同意我的意见。','绿灯亮了，表示我们可以过马路了。','表示不要','表示态度','表示心意','表示意见'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',15,'忽然','hū rán','suddenly','both',false,'事情发生得迅速而又没预料到；突然。','他忽然大叫一声，吓了我一跳。','她说着用忽然哭了起来，不知道有什么心事。','忽然想起','忽然下雨','忽然刮风','忽然发生'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',16,'灵机一动','líng jī yī dòng','struck with a good idea','read',false,'形容灵敏机智，临时想出了好主意来。','正当大家不知怎么办的时候，小军灵机一动，突然想出了一个好方法来。','小华脑筋好，遇到任何事，灵机一动就会想出办法来。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',17,'挤','jǐ','crowd; pack','both',false,'人或东西紧紧靠在一起。','街边挤满了人，等着看花车大游行。','下班的时候，巴士上挤满了人。',null,null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',18,'靠','kào','close to; near','both',false,'接近；挨近。','大冷天，墙角的两只小猫紧紧地靠在一起。','你靠得我这么近，热死了！','靠紧','靠近','靠得紧紧','依靠'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',19,'撑着','chēng zhe','hold up (an umbrella)','read',false,'张开（伞）。','她撑着伞，慢慢地走在细雨中。','妈妈撑着雨伞，把我拉近她的身体。','撑着雨伞',null,null,null),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',20,'担心','dān xīn','worry','both',true,'心中有顾虑；不放心。','这件事我能处理好，你不必担心。','哥哥每次出远门，妈妈总会很担心。','担心被骂','担心受罚','就很担心','不必担心'),
  ('P5','huanlehuoban-2025',2,'我们是兄弟姐妹',21,'不怕','bù pà','not fear','read',false,'不害怕。','破漏的屋顶终于修补好了，再也不怕下雨了。','企鹅生活在寒冷的地方，一点也不怕冷。','不怕寒冷','不怕肮脏','不怕劳累','再也不怕')
on conflict (primary_level, edition, chapter_number, sort) do update set
  chapter_title = excluded.chapter_title,
  hanzi = excluded.hanzi,
  pinyin = excluded.pinyin,
  english = excluded.english,
  skill = excluded.skill,
  is_higher_chinese = excluded.is_higher_chinese,
  cn_definition = excluded.cn_definition,
  sentence_1 = excluded.sentence_1,
  sentence_2 = excluded.sentence_2,
  pairing_1 = excluded.pairing_1,
  pairing_2 = excluded.pairing_2,
  pairing_3 = excluded.pairing_3,
  pairing_4 = excluded.pairing_4;
