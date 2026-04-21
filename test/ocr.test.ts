import { describe, expect, it } from 'vitest'
import { performOCR } from './../server/agent/subagents/ocr'

describe.skip('performOCR', () => {
  it('should return the OCR result', async () => {
    const imageUrl = 'https://mmecoa.qpic.cn/sz_mmecoa_png/Jgm1DliahzhRF6SFNEIbxvIAVCuqUqMXiaibvKxgJ7jrVHqH90kfDhzgY2n03Qrblgba2E6oC4c6pHMlkc1nP0AJ7CNwsTb67DY4rqzSwUDzY8/640?wx_fmt=png&from=appmsg#imgIndex=3'
    const ocrResult = await performOCR(imageUrl)
    expect(ocrResult).toMatchInlineSnapshot(`
      {
        "dataInfo": {
          "height": 325,
          "type": "image",
          "width": 711,
        },
        "layoutParsingResults": [
          {
            "inputImage": "https://pplines-online.bj.bcebos.com/deploy/official/paddleocr/pp-ocr-vl-15//680f97a3-390f-491d-9cdd-4a48a7759897/input_img_0.jpg?authorization=bce-auth-v1%2FALTAKzReLNvew3ySINYJ0fuAMN%2F2026-04-20T08%3A27%3A07Z%2F-1%2F%2F544494e7fe19f83dc36ae7871b8312cb22210354c5d8827ca99faa4c5480670a",
            "markdown": {
              "images": {},
              "text": "
      <table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>二等奖</td><td style='text-align: center; word-wrap: break-word;'>399元微信立减金券包</td><td style='text-align: center; word-wrap: break-word;'>200元（涵盖2张100元）</td><td style='text-align: center; word-wrap: break-word;'>100元（涵盖1张100元）</td><td style='text-align: center; word-wrap: break-word;'>99元（涵盖1张99元）</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>三等奖</td><td style='text-align: center; word-wrap: break-word;'>99元微信立减金券包</td><td style='text-align: center; word-wrap: break-word;'>30元（涵盖1张30元）</td><td style='text-align: center; word-wrap: break-word;'>30元（涵盖1张30元）</td><td style='text-align: center; word-wrap: break-word;'>39元（涵盖1张39元）</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>四等奖</td><td style='text-align: center; word-wrap: break-word;'>20元微信立减金券包</td><td style='text-align: center; word-wrap: break-word;'>10元（涵盖1张10元）</td><td style='text-align: center; word-wrap: break-word;'>5元（涵盖1张5元）</td><td style='text-align: center; word-wrap: break-word;'>5元（涵盖1张5元）</td></tr></table>",
            },
            "outputImages": {
              "layout_det_res": "https://pplines-online.bj.bcebos.com/deploy/official/paddleocr/pp-ocr-vl-15//680f97a3-390f-491d-9cdd-4a48a7759897/layout_det_res_0.jpg?authorization=bce-auth-v1%2FALTAKzReLNvew3ySINYJ0fuAMN%2F2026-04-20T08%3A27%3A07Z%2F-1%2F%2F72f2bde2b51c8895185aa15f04e8c9291ff714eb0b5667a693a2d8301fb180e1",
            },
            "prunedResult": {
              "height": 325,
              "layout_det_res": {
                "boxes": [
                  {
                    "cls_id": 21,
                    "coordinate": [
                      0,
                      0,
                      711,
                      318,
                    ],
                    "label": "table",
                    "order": null,
                    "polygon_points": [
                      [
                        0,
                        0,
                      ],
                      [
                        711,
                        0,
                      ],
                      [
                        711,
                        318,
                      ],
                      [
                        0,
                        318,
                      ],
                    ],
                    "score": 0.9826000332832336,
                  },
                ],
              },
              "model_settings": {
                "format_block_content": false,
                "markdown_ignore_labels": [
                  "number",
                  "footnote",
                  "header",
                  "header_image",
                  "footer",
                  "footer_image",
                  "aside_text",
                ],
                "merge_layout_blocks": true,
                "return_layout_polygon_points": true,
                "use_chart_recognition": false,
                "use_doc_preprocessor": false,
                "use_layout_detection": true,
                "use_ocr_for_image_block": false,
                "use_seal_recognition": false,
              },
              "page_count": null,
              "parsing_res_list": [
                {
                  "block_bbox": [
                    0,
                    0,
                    711,
                    318,
                  ],
                  "block_content": "<table><tr><td>二等奖</td><td>399元微信立减金券包</td><td>200元（涵盖2张100元）</td><td>100元（涵盖1张100元）</td><td>99元（涵盖1张99元）</td></tr><tr><td>三等奖</td><td>99元微信立减金券包</td><td>30元（涵盖1张30元）</td><td>30元（涵盖1张30元）</td><td>39元（涵盖1张39元）</td></tr><tr><td>四等奖</td><td>20元微信立减金券包</td><td>10元（涵盖1张10元）</td><td>5元（涵盖1张5元）</td><td>5元（涵盖1张5元）</td></tr></table>",
                  "block_id": 0,
                  "block_label": "table",
                  "block_order": null,
                  "block_polygon_points": [
                    [
                      0,
                      0,
                    ],
                    [
                      711,
                      0,
                    ],
                    [
                      711,
                      318,
                    ],
                    [
                      0,
                      318,
                    ],
                  ],
                  "group_id": 0,
                },
              ],
              "width": 711,
            },
          },
        ],
        "preprocessedImages": [
          "https://pplines-online.bj.bcebos.com/deploy/official/paddleocr/pp-ocr-vl-15//680f97a3-390f-491d-9cdd-4a48a7759897/preprocessed_img_0.jpg?authorization=bce-auth-v1%2FALTAKzReLNvew3ySINYJ0fuAMN%2F2026-04-20T08%3A27%3A07Z%2F-1%2F%2F8e291cf3615ea48a615f99eb05f931375b9c681f666690767b36c87193de318a",
        ],
      }
    `)
  })
})
