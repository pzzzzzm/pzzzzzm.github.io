// implemented by bing ai with manual modifications

var input = $("#floatingTextarea"); // The input block
var shiftFrom = $("input[aria-label='from-shift']"); // The shift from value
var shiftTo = $("input[aria-label='to-shift']"); // The shift to value
var decodeButton = $("#decode"); // The decode button

// Get the result block element from the HTML file by its id
var resultBlock = $("#result");
var moreResultBlock = $("#more-results");

// Get the button element from the HTML file by its id
var sh_button = $("#show-hide");

decodeButton.click(read);

words_en = freq_words_en;

// Define the read function
function read() {
    // Get the input message and the shift values
    var message = input.val();
    var from = parseInt(shiftFrom.val());
    var to = parseInt(shiftTo.val());

    // Check if the input message is not empty
    if (message) {
        // Check if the shift values are valid
        if (from >= 1 && from <= 25 && to >= 1 && to <= 25 && from <= to) {
            // Send the input message and the shift values to the process function
            res = decoding(message, from, to);
            console.log(res);
            display(res);
            // alert(message);
        } else {
            // Alert the user that the shift values are invalid
            alert("Please enter valid shift values from 1 to 25.");
        }
    } else {
        // Alert the user that the input message is empty
        alert("Please enter a message to decode.");
    }
}

function wordMatch(input, fw_json) {
    // Split the input string into words
    var words = input.split(" ");
    // Initialize a counter variable
    var count = 0;
    // Loop through the words array
    for (var i = 0; i < words.length; i++) {
        // Check if the word is in the json file
        if (fw_json[words[i].toLowerCase()]) {
            // Increment the counter variable
            count ++;
        }
    }
    // Return the counter variable as the result
    return count/words.length;
}

// Define the function
function shiftString(str, shift) {
    // Initialize a new string
    var newStr = "";
    // Loop through each character of the string
    for (var i = 0; i < str.length; i++) {
      // Get the ASCII code of the character
      var code = str.charCodeAt(i);
      // Check if the character is an uppercase letter
      if (code >= 65 && code <= 90) {
        // Add the shift value and wrap it around the range of 65 to 90
        code = (code - 65 + shift) % 26 + 65;
      }
      // Check if the character is a lowercase letter
      else if (code >= 97 && code <= 122) {
        // Add the shift value and wrap it around the range of 97 to 122
        code = (code - 97 + shift) % 26 + 97;
      }
      // Convert the shifted code back to a character
      var char = String.fromCharCode(code);
      // Append the character to the new string
      newStr += char;
    }
    // Return the new string as the result
    return newStr;
  }
  
// Define the decoding function
function decoding(message, from, to) {
    // Initialize an empty set to store the results
    var results = [];
    // Loop through the shift range
    for (var i = 1; i <= to; i++) {
      // Get the decoded string for each shift value
      var message = shiftString(message, 1);
      if (i < from) continue;
      // Get the score for each decoded string
      var score = wordMatch(message, words_en);
      // Create an object that contains the score, the shift, and the decoded string
      var result = {
        score: score,
        shift: i,
        decoded: message
      };
      // Add the object to the set of results
      results.push(result);
    }
    // Sort the set of results by the score in descending order
    results.sort(function(a, b) {
      return b.score - a.score;
    });
    // Return the set of results as the output
    return results;
  }


// Define the display function
function display(results) {
  // Clear the previous content of the result block
  resultBlock.empty();
  moreResultBlock.empty();
  // Loop through the set of results
  for (var i = 0; i < results.length; i++) {
    // Create a new <div> element for each result element, using the HTML template as an argument
    var resultDiv = $(`
      <div class="card-body result-row">
        <p class="card-text">Score: score, Shift: shift</p>
        <p class="card-text">decoded string</p>
      </div>
    `);
    // Replace the placeholders in the template with the actual values from the result element, using the text() method
    resultDiv.find(".card-text").eq(0).text("Score: " + results[i].score.toString().slice(0, 5) + ", Shift: " + results[i].shift);
    resultDiv.find(".card-text").eq(1).text(results[i].decoded);
    // Append the new <div> element to the result block, using the append() method
    if (i < 3) resultBlock.append(resultDiv)
    else moreResultBlock.append(resultDiv);
  }
//   $(".result-row").slice(0, 3).show();
}

sh_button.click(function() {
    // Change the text of the button accordingly, using the text() method
    if (sh_button.text() == "Show all") {
        sh_button.text("Collapse");
    } else {
        sh_button.text("Show all");
    }
});