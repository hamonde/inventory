-- 配方豆名稱去掉結尾「豆」字（鳳香/桃香/白葡萄/荔香）
UPDATE beans SET name = '鳳香配方'   WHERE name = '鳳香配方豆';
UPDATE beans SET name = '桃香配方'   WHERE name = '桃香配方豆';
UPDATE beans SET name = '白葡萄配方' WHERE name = '白葡萄配方豆';
UPDATE beans SET name = '荔香配方'   WHERE name = '荔香配方豆';
