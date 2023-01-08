
$('#dot-based').on('click', function (){
    $('.type-block button').val(0).html('点深度二值化');
    $('#thresh-value').removeAttr('disabled');
    $('.thresh-comment').html('0-255');
})

$('#edge-based').on('click', function (){
    $('.type-block button').val(3).html('边缘二值化');
    $('#thresh-value').removeAttr('disabled');
    $('.thresh-comment').html('0-255');
})

$('#block-based').on('click', function (){
    $('.type-block button').val(1).html('块深度');
    $('#thresh-value').attr('disabled', 'disabled');
    $('.thresh-comment').html('不可用');
})

$('#block-based-equalized').on('click', function (){
    $('.type-block button').val(2).html('均衡化的块深度');
    $('#thresh-value').attr('disabled', 'disabled');
    $('.thresh-comment').html('不可用');
})


function getInput() {
    return cv.imread('raw-img');
}

function processImgMat(mat, row) {
    let w = mat.size()['width'];
    let h = mat.size()['height'];

    let w_char = 3 * row;
    let h_char = Math.floor(h / w * w_char);
    let h_compl = 0;

    if (h_char % 5) {
        h_compl = 5 - (h_char % 5);
    }

    let resized_mat = new cv.Mat();

    let rm_size = new cv.Size(w_char, h_char);
    cv.resize(mat, resized_mat, rm_size, 0, 0, cv.INTER_AREA)

    let padding = new cv.Scalar(255);
    let padded_mat = new cv.Mat();

    cv.copyMakeBorder(resized_mat, padded_mat, 0, h_compl, 0, 0, cv.BORDER_CONSTANT, padding);

    resized_mat.delete();

    return padded_mat

}

// function block2Unicode(block, thresh) {
//     if (block.size()['width'] !== 2 || block.size()['height'] !== 4) {
//         throw 'Bad block size.'
//     }
//     let sum = 10240;
//     if (block.data[0] < thresh) sum += 1;
//     if (block.data[1] < thresh) sum += 2;
//     if (block.data[2] < thresh) sum += 4;
//     if (block.data[3] < thresh) sum += 64;
//     if (block.data[4] < thresh) sum += 8;
//     if (block.data[5] < thresh) sum += 16;
//     if (block.data[6] < thresh) sum += 32;
//     if (block.data[7] < thresh) sum += 128;
//
//     sum = sum.toString(16);
//
//     return String.fromCharCode('0x' + sum);
// }

function convertGray(mat) {
    let img_g = new cv.Mat();
    cv.cvtColor(mat, img_g, cv.COLOR_RGBA2GRAY, 0);
    return img_g;
}

// maybe other methods could be implemented
function preprocessing(mat) {
    return convertGray(mat);
}

function edgeDetect(mat) {
    let edgeMat = new cv.Mat();
    cv.Canny(mat, edgeMat, 50, 200);

    let dilatedMat = new cv.Mat();
    let M = cv.Mat.ones(3, 3, cv.CV_8U);
    let anchor = new cv.Point(-1, -1);
    cv.dilate(edgeMat, dilatedMat, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

    edgeMat.delete();
    M.delete();

    let w = dilatedMat.size()['width'];
    let h = dilatedMat.size()['height'];
    let tempArr = new Array(w*h).fill(255);
    let tempMat = cv.matFromArray(h, w, cv.CV_8U, tempArr);
    let complMat = new cv.Mat();
    let mask = new cv.Mat();
    cv.subtract(tempMat, dilatedMat, complMat, mask, -1);

    tempMat.delete();
    dilatedMat.delete();
    mask.delete();

    // for (let x = 0; x < n; x ++) {
    //     if (dilatedMat.data[x] === 0) {
    //         dilatedMat.data[x] = 255;
    //     }
    //     else {
    //         dilatedMat.data[x] = 0;
    //     }
    // }

    return complMat;

}

function dotBasedConvert(img_char, thresh) {
    let w = img_char.size()['width'];
    let h = img_char.size()['height'];

    let res = '';

    for (let r = 0; r < h; r += 5) {
        for (let c = 0; c < w; c += 3) {
            let sum = 10241;
            // if (img_char.data[r * w + c] < thresh) sum += 1;
            if (img_char.data[(r + 1) * w + c] < thresh) sum += 2;
            if (img_char.data[(r + 2) * w + c] < thresh) sum += 4;
            if (img_char.data[(r + 3) * w + c] < thresh) sum += 64;
            if (img_char.data[r * w + c + 1] < thresh) sum += 8;
            if (img_char.data[(r + 1) * w + c + 1] < thresh) sum += 16;
            if (img_char.data[(r + 2) * w + c + 1] < thresh) sum += 32;
            if (img_char.data[(r + 3) * w + c + 1] < thresh) sum += 128;
            res = res + String.fromCharCode('0x' + sum.toString(16));
        }
        res = res + '<br/>';
    }

    return res;
}


function blockBasedConvert(img_char, is_equalized) {

    let w = img_char.size()['width']/3;
    let h = Math.floor(img_char.size()['height']/2.5);

    let res = '';

    let sample_size = new cv.Size(w, h);

    cv.resize(img_char, img_char, sample_size, 0, 0, cv.INTER_AREA);
    if (is_equalized) cv.equalizeHist(img_char, img_char);

    for (let r = 0; r < h; r += 2) {
        for (let c = 0; c < w; c += 1) {
            let sum = 10240;
            let depth1 = Math.floor(img_char.data[r*w+c]/32);
            let depth2 = Math.floor(img_char.data[(r+1)*w+c]/32);

            if (depth1 < 2) sum += 1;
            if (depth1 < 4) sum += 16;
            if (depth1 < 6) sum += 8;
            if (depth1 < 8) sum += 2;

            if (depth2 < 2) sum += 128;
            if (depth2 < 4) sum += 4;
            if (depth2 < 6) sum += 64;
            if (depth2 < 8) sum += 32;

            if (depth1 === 7 && depth2 === 7) sum = 10242;

            // switch (depth) {
            //     case 0:
            //         sum += 64;
            //     case 1:
            //         sum += 8;
            //     case 2:
            //         sum += 32;
            //     case 3:
            //         sum += 2;
            //     case 4:
            //         sum += 128;
            //     case 5:
            //         sum += 1;
            //     case 6:
            //         sum += 16;
            //     case 7:
            //         sum += 4;
            // }
            res = res + String.fromCharCode('0x' + sum.toString(16));
        }
        res = res + '<br/>';
    }
    return res;
}

function convertImage() {

    // let row = 35;
    // let thresh = 122;

    let row = $('#col-value').val();
    let thresh = $('#thresh-value').val();
    let conv_type = $('.type-block button').val();

    let img = getInput();

    let img_g;

    switch (conv_type){
        case '3':
            img_g = edgeDetect(img); break;
        default:
            img_g = preprocessing(img);
    }

    img.delete();

    let img_char = processImgMat(img_g, row);
    img_g.delete()

    let res;

    switch (conv_type){
        case '0': res = dotBasedConvert(img_char, thresh); break;
        case '1': res = blockBasedConvert(img_char, 0); break;
        case '2': res = blockBasedConvert(img_char, 1); break;
        case '3': res = dotBasedConvert(img_char, thresh); break;
    }

    img_char.delete();

    // return img_char;
    // $('#output-text textarea').text(res).attr('rows', h).attr('cols', w);
    $('#output-text p').html(res);


}