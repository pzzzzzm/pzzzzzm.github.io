let default_list  = "英雄联盟,守望先锋,APEX";
let game_list = [];
if (getCookie("glist").length === 0) {
  game_list = str2array(default_list);
}
else {
  loadGames();
}

let game_dict = {};
let score_dict = {
  "high": 8,
  "mid": 4,
  "low": 2,
};
let cnt = 0;

const game_block =
    "<div class=\"input-group mb-3 game-block\">\n" +
    "  <span class=\"input-group-text game-title\"></span>\n" +
    "  <button class=\"btn btn-outline-secondary score score-high score-selected\" type=\"button\">很想玩😍</button>\n" +
    "  <button class=\"btn btn-outline-secondary score score-mid\" type=\"button\">有点想玩😃</button>\n" +
    "  <button class=\"btn btn-outline-secondary score score-low\" type=\"button\">玩也行🙂</button>\n" +
    "  <button class=\"btn btn-outline-secondary score score-zero\" type=\"button\">不想玩了🙁</button>\n" +
    "  <button class=\"btn btn-outline-secondary score score-delete\" type=\"button\">🐶都不玩，删了！<i class=\"bi bi-x\"></i></button>\n" +
    "</div>";

function saveGames(glist) {
  setCookie("glist", array2str(glist), 30);
}

function loadGames() {
  game_list = str2array(getCookie("glist"));
}

function resetGames() {
  saveGames(str2array(default_list));
  location.reload();
}

function addGame(game_title) {
  $(".game-list").append(game_block);
  $(".game-block").last().attr("id", cnt);
  $(".game-block").last().children(".game-title").text(game_title);
  game_dict[cnt] = game_title;
  cnt ++;
  sizeCheck();
  saveGames(Object.values(game_dict));
}

function setScores() {
  $(".score-selected.score-high").siblings("span").attr("score", score_dict["high"]);
  $(".score-selected.score-mid").siblings("span").attr("score", score_dict["mid"]);
  $(".score-selected.score-low").siblings("span").attr("score", score_dict["low"]);
  $(".score-selected.score-zero").siblings("span").attr("score", 0);
}

function getGame() {
  setScores();
  let ids = Object.keys(game_dict);
  let ranges = [];
  let sum = 0;
  for (let i of ids) {
    let s = parseInt($("#"+i+" span").attr("score"));
    sum += s;
    ranges.push(sum);
  }
  let res = Math.random() * sum;
  let ind = 0;
  for (let r of ranges) {
    if (res < r) {
      break;
    }
    else {
      ind ++;
    }
  }
  console.log("Game range:");
  console.log(ranges);
  console.log("Target:");
  console.log(res);
  $(".result-block").css("visibility", "visible")
  $(".game-title-result").text(game_dict[ids[ind]]+"！");
}

function sizeCheck() {
  if ($(window).width() < 1000) {
    $(".score-high").text("😍");
    $(".score-mid").text("😃");
    $(".score-low").text("🙂");
    $(".score-zero").text("🙁");
    $(".score-delete").html("<i class=\"bi bi-x\"></i>");
  }
 else {
   $(".score-high").text("很想玩😍");
   $(".score-mid").text("有点想玩😃");
   $(".score-low").text("玩也行🙂");
   $(".score-zero").text("不想玩了🙁");
   $(".score-delete").html("🐶都不玩，删了！<i class=\"bi bi-x\"></i>");
 }
}

for (const g of game_list) {
  game_dict[cnt] = g;
  addGame(g, cnt);
}

setScores();
sizeCheck();

$(document).ready(function(){
  $(".game-list").on('click', '.score', function (){
    $(this).siblings().removeClass("score-selected");
    $(this).addClass("score-selected");
    setScores();
  })
  .on('click', '.score-delete', function (){
    let this_id = $(this).parent().attr("id");
    delete game_dict[this_id];
    $(".game-block#" + this_id).remove();
    saveGames(Object.values(game_dict));
  })

  $(".add-game").click(function (){
    let $input = $(".add-game-block input");
    if ($input.val() !== "") {
      let new_title = $input.val();
      addGame(new_title);
      $input.val("");
    }
  });
  $(".start-button").click(function (){
    getGame();
  })
  $(".reset-button").click(resetGames);

  $(window).resize(sizeCheck);

});
