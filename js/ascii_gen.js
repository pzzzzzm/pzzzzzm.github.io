

function getInput() {
    return cv.imread('input-img');
}

function processImgMat(mat, row) {
    let w = mat.size()['width'];
    let h = mat.size()['height'];

    let w_char = 3*row;
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

function convertImage() {

    // let row = 35;
    // let thresh = 122;

    let row = $('#col-value').val();
    let thresh = $('#thresh-value').val();

    let img = getInput();
    let img_g = preprocessing(img);
    img.delete();

    let img_char = processImgMat(img_g, row);
    img_g.delete()
    let w = img_char.size()['width'];
    let h = img_char.size()['height'];

    let res = '';
    let roi_block = new cv.Mat();

    // for (let r = 0; r < h; r += 4) {
    //     for (let c = 0; c < w; c += 2) {
    //         let rect = new cv.Rect(c, r, 2, 4);
    //         roi_block = img_char.roi(rect);
    //         res = res + block2Unicode(roi_block, thresh);
    //     }
    //     res = res + '\n';
    // }

    for (let r = 0; r < h; r += 5) {
        for (let c = 0; c < w; c += 3) {
            let sum = 10241;
            // if (img_char.data[r * w + c] < thresh) sum += 1;
            if (img_char.data[(r+1) * w + c] < thresh) sum += 2;
            if (img_char.data[(r+2) * w + c] < thresh) sum += 4;
            if (img_char.data[(r+3) * w + c] < thresh) sum += 64;
            if (img_char.data[r * w + c + 1] < thresh) sum += 8;
            if (img_char.data[(r+1) * w + c + 1] < thresh) sum += 16;
            if (img_char.data[(r+2) * w + c + 1] < thresh) sum += 32;
            if (img_char.data[(r+3) * w + c + 1] < thresh) sum += 128;
            res = res + String.fromCharCode('0x' + sum.toString(16));
        }
        res = res + '<br/>';
    }

    // img_char.delete();
    roi_block.delete();

    // return img_char;
    // $('#output-text textarea').text(res).attr('rows', h).attr('cols', w);
    $('#output-text p').html(res);


}