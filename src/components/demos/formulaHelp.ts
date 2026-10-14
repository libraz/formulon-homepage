/** Host-side guidance layered over the live function catalog. */

export type FormulaLocale = 'en' | 'ja'

export interface FormulaDescription {
  en: string
  ja: string
}

export interface ParameterHelp {
  en: string
  ja: string
  example?: string
}

export interface SyntaxTip {
  key: string
  en: string
  ja: string
  example: string
}

export interface ParsedParameter {
  raw: string
  key: string
  required: boolean
  repeat: boolean
}

const HELP: Readonly<Record<string, Readonly<Record<string, ParameterHelp>>>> = {
  AND: {
    logical1: {
      en: 'The first condition, such as 3>2.',
      ja: '最初の条件。例: 3>2。',
      example: '3>2'
    },
    logical2: {
      en: 'Another condition. More conditions can follow.',
      ja: '追加の条件。後ろに条件を続けられます。',
      example: '5<10'
    }
  },
  DATE: {
    year: { en: 'The year, for example 2026.', ja: '年。例: 2026。', example: '2026' },
    month: { en: 'The month number, such as 8.', ja: '月の番号。例: 8。', example: '8' },
    day: { en: 'The day of the month, such as 11.', ja: '日の番号。例: 11。', example: '11' }
  },
  FILTER: {
    array: {
      en: 'The source range or array to return.',
      ja: '返す元の範囲または配列。',
      example: '{1,2;3,4}'
    },
    include: {
      en: 'A TRUE/FALSE mask with one item per row or column.',
      ja: '行または列ごとの TRUE/FALSE 配列。',
      example: '{1;2}>1'
    },
    if_empty: {
      en: 'The value to show when no item matches.',
      ja: '一致がないときに表示する値。',
      example: '"なし"'
    }
  },
  IF: {
    logical_test: {
      en: 'A condition that evaluates to TRUE or FALSE.',
      ja: 'TRUE または FALSE になる条件。',
      example: '3>2'
    },
    value_if_true: {
      en: 'The result when the condition is TRUE.',
      ja: '条件が TRUE のときの結果。',
      example: '"在庫あり"'
    },
    value_if_false: {
      en: 'The result when the condition is FALSE.',
      ja: '条件が FALSE のときの結果。',
      example: '"在庫なし"'
    }
  },
  IFERROR: {
    value: { en: 'The expression to evaluate.', ja: '評価する式。', example: '1/0' },
    value_if_error: {
      en: 'The result to use when that expression returns an error.',
      ja: '式がエラーになったときの結果。',
      example: '0'
    }
  },
  INDEX: {
    array: {
      en: 'The source range or array.',
      ja: '元の範囲または配列。',
      example: '{10,20;30,40}'
    },
    row_num: { en: 'The row number inside the array.', ja: '配列内の行番号。', example: '2' },
    col_num: { en: 'The column number inside the array.', ja: '配列内の列番号。', example: '2' }
  },
  MATCH: {
    lookup_value: { en: 'The value to find.', ja: '検索する値。', example: '20' },
    lookup_array: {
      en: 'The one-row or one-column search array.',
      ja: '検索対象の 1 行または 1 列の配列。',
      example: '{10;20;30}'
    },
    match_type: {
      en: '0 for an exact match; 1 or -1 select sorted matching.',
      ja: '0 は完全一致。1 または -1 は並べ替え済みの検索。',
      example: '0'
    }
  },
  ROUND: {
    number: {
      en: 'The number or expression to round.',
      ja: '丸める数値または式。',
      example: '12.345'
    },
    num_digits: {
      en: 'Digits to keep: 2 keeps hundredths, 0 rounds to an integer, -1 to tens.',
      ja: '残す桁数。2 は小数第 2 位、0 は整数、-1 は十の位です。',
      example: '2'
    }
  },
  ROUNDDOWN: {
    number: {
      en: 'The number or expression to round down.',
      ja: '切り捨てる数値または式。',
      example: '12.345'
    },
    num_digits: {
      en: 'Digits to keep; rounding is toward zero.',
      ja: '残す桁数。0 に近づく方向へ丸めます。',
      example: '2'
    }
  },
  ROUNDUP: {
    number: {
      en: 'The number or expression to round up.',
      ja: '切り上げる数値または式。',
      example: '12.341'
    },
    num_digits: {
      en: 'Digits to keep; rounding is away from zero.',
      ja: '残す桁数。0 から遠ざかる方向へ丸めます。',
      example: '2'
    }
  },
  SEQUENCE: {
    rows: { en: 'The number of rows to generate.', ja: '生成する行数。', example: '3' },
    columns: { en: 'The number of columns to generate.', ja: '生成する列数。', example: '4' },
    cols: { en: 'The number of columns to generate.', ja: '生成する列数。', example: '4' },
    start: { en: 'The first value in the sequence.', ja: '配列の最初の値。', example: '10' },
    step: { en: 'The amount added between values.', ja: '値と値の間に加える差分。', example: '5' }
  },
  SORT: {
    array: {
      en: 'The range or array to sort.',
      ja: '並べ替える範囲または配列。',
      example: '{3,1;2,4}'
    },
    sort_index: {
      en: 'The row or column number used for sorting.',
      ja: '並べ替えに使う行番号または列番号。',
      example: '2'
    },
    sort_order: {
      en: '1 for ascending order; -1 for descending order.',
      ja: '1 は昇順、-1 は降順です。',
      example: '-1'
    },
    by_col: {
      en: 'TRUE sorts by columns; FALSE sorts by rows.',
      ja: 'TRUE は列方向、FALSE は行方向に並べ替えます。',
      example: 'FALSE'
    }
  },
  TEXT: {
    value: {
      en: 'The number or date to format.',
      ja: '書式を設定する数値または日付。',
      example: '1234.5'
    },
    format_text: {
      en: 'A format pattern such as "#,##0.00" or "yyyy-mm-dd".',
      ja: '"#,##0.00" や "yyyy-mm-dd" のような書式パターン。',
      example: '"#,##0.00"'
    }
  },
  TEXTJOIN: {
    delimiter: {
      en: 'Text inserted between each item.',
      ja: '項目の間に入れる文字列。',
      example: '", "'
    },
    ignore_empty: {
      en: 'TRUE skips empty items; FALSE keeps them.',
      ja: 'TRUE は空の項目を省略し、FALSE は残します。',
      example: 'TRUE'
    },
    text1: {
      en: 'The first text, range or array to join.',
      ja: '結合する最初の文字列・範囲・配列。',
      example: '{"a";"b"}'
    }
  },
  UNIQUE: {
    array: {
      en: 'The range or array from which to remove duplicates.',
      ja: '重複を除く範囲または配列。',
      example: '{1;1;2;3}'
    },
    by_col: {
      en: 'TRUE compares columns; FALSE compares rows.',
      ja: 'TRUE は列、FALSE は行を比較します。',
      example: 'FALSE'
    },
    exactly_once: {
      en: 'TRUE keeps values that occur exactly once.',
      ja: 'TRUE は 1 回だけ現れる値を残します。',
      example: 'TRUE'
    }
  },
  VLOOKUP: {
    lookup_value: {
      en: 'The value to find in the first table column.',
      ja: '表の先頭列で検索する値。',
      example: '1'
    },
    table_array: {
      en: 'The table containing the lookup and return columns.',
      ja: '検索列と結果列を含む表。',
      example: '{1,"Osaka";2,"Tokyo"}'
    },
    col_index_num: {
      en: 'The 1-based column number to return.',
      ja: '返す列の 1 始まりの番号。',
      example: '2'
    },
    range_lookup: {
      en: 'FALSE requests an exact match; TRUE allows an approximate match.',
      ja: 'FALSE は完全一致、TRUE は近似一致です。',
      example: 'FALSE'
    }
  },
  XLOOKUP: {
    lookup_value: { en: 'The value to find.', ja: '検索する値。', example: '2' },
    lookup_array: {
      en: 'The one-row or one-column array to search.',
      ja: '検索対象の 1 行または 1 列の配列。',
      example: '{1;2;3}'
    },
    return_array: {
      en: 'The corresponding row or column to return.',
      ja: '対応する結果を返す行または列。',
      example: '{"a";"b";"c"}'
    },
    if_not_found: {
      en: 'The value shown when no match exists.',
      ja: '一致がないときに表示する値。',
      example: '"該当なし"'
    },
    match_mode: {
      en: '0 exact; -1 exact or next smaller; 1 exact or next larger; 2 wildcard; 3 regular expression.',
      ja: '0 は完全一致、-1 は完全一致か次に小さい値、1 は完全一致か次に大きい値、2 はワイルドカード、3 は正規表現です。',
      example: '0'
    },
    search_mode: {
      en: '1 first-to-last; -1 last-to-first; 2 binary ascending; -2 binary descending.',
      ja: '1 は先頭から、-1 は末尾から、2 は昇順の二分探索、-2 は降順の二分探索です。',
      example: '1'
    }
  }
}

const VARIADIC_HELP: Readonly<Record<string, ParameterHelp>> = {
  LET: {
    en: 'Additional name/value pairs, or the final calculation, may follow the ellipsis.',
    ja: '省略記号の後には名前と値の組、または最後の計算式が続きます。'
  },
  LAMBDA: {
    en: 'Additional parameters, or the final calculation, may follow the ellipsis.',
    ja: '省略記号の後には追加のパラメーター、または最後の計算式が続きます。'
  },
  MAP: {
    en: 'Additional arrays, or the final lambda, may follow the ellipsis.',
    ja: '省略記号の後には追加の配列、または最後のラムダ式が続きます。'
  }
}

export function variadicParameterHelp(functionName: string): ParameterHelp | undefined {
  return VARIADIC_HELP[functionName.toUpperCase()]
}

export const SYNTAX_TIPS: readonly SyntaxTip[] = [
  {
    key: 'formula-start',
    en: 'Formulas start with =; separate arguments with commas.',
    ja: '数式は = で始まり、引数はカンマで区切ります。',
    example: '=SUM(1,2,3)'
  },
  {
    key: 'placeholders',
    en: '[argument] marks an optional placeholder (do not type the brackets); ... means additional arguments.',
    ja: '[argument] は省略可能なプレースホルダー（角括弧は入力しません）、... は追加引数を表します。',
    example: 'SUM(number1,[number2],...)'
  },
  {
    key: 'strings',
    en: 'Strings use double quotes; escape a quote as "".',
    ja: '文字列は二重引用符で囲み、引用符は "" と書きます。',
    example: '"A,B"'
  },
  {
    key: 'booleans',
    en: 'Use TRUE/FALSE or a comparison such as 3>2.',
    ja: 'TRUE/FALSE、または 3>2 のような比較式を使います。',
    example: '3>2'
  },
  {
    key: 'ranges',
    en: "Workbook mode: A1:A10 is a range; Sheet2!B2 or 'Sales 2026'!B2 qualifies a sheet.",
    ja: "ワークブック参照時: A1:A10 は範囲、Sheet2!B2 や 'Sales 2026'!B2 はシート指定です。",
    example: 'A1:A10'
  },
  {
    key: 'arrays',
    en: 'Array constants use commas for columns and semicolons for rows.',
    ja: '配列定数は列をカンマ、行をセミコロンで区切ります。',
    example: '{1,2;3,4}'
  },
  {
    key: 'nesting',
    en: 'Nest calls from the inside out: =ROUND(AVERAGE(1,2,3),2).',
    ja: '内側から関数を組み合わせます。例: =ROUND(AVERAGE(1,2,3),2)。',
    example: '=ROUND(AVERAGE(1,2,3),2)'
  }
]

export function parseParameter(raw: string): ParsedParameter {
  const trimmed = raw.trim()
  if (trimmed === '...' || trimmed === '…')
    return { raw, key: '...', required: false, repeat: true }
  const optional = trimmed.startsWith('[') && trimmed.endsWith(']')
  const key = optional ? trimmed.slice(1, -1) : trimmed
  return { raw, key: key || 'arg', required: !optional, repeat: false }
}

export function parameterBase(key: string): string {
  return key.replace(/\d+$/, '')
}

export function parameterHelp(
  functionName: string,
  raw: string,
  index: number,
  _locale: FormulaLocale
): ParameterHelp {
  const name = functionName.toUpperCase()
  const parsed = parseParameter(raw)
  if (parsed.repeat) {
    return {
      en: 'Additional arguments follow the signature pattern.',
      ja: 'シグネチャのパターンに沿って追加の引数を続けます。'
    }
  }
  const specific = HELP[name]?.[parsed.key] ?? HELP[name]?.[parameterBase(parsed.key)]
  if (specific) return specific
  const key = parameterBase(parsed.key)
  return key === 'range' ||
    key.endsWith('_range') ||
    key === 'array' ||
    key.endsWith('_array') ||
    key === 'by_array'
    ? {
        en: 'A range or array, such as {1;2;3}.',
        ja: '{1;2;3} のような範囲または配列。',
        example: '{1;2;3}'
      }
    : key === 'logical' || key.startsWith('logical_')
      ? {
          en: 'A condition that evaluates to TRUE or FALSE.',
          ja: 'TRUE または FALSE になる条件。',
          example: '3>2'
        }
      : key === 'boolean' || key === 'by_col' || key === 'by_column'
        ? {
            en: 'TRUE or FALSE, or an expression returning one.',
            ja: 'TRUE または FALSE、またはそれを返す式。',
            example: 'TRUE'
          }
        : key === 'text' || key.startsWith('text')
          ? {
              en: 'Text, a reference to text, or an expression.',
              ja: '文字列、文字列への参照、または式。',
              example: '"text"'
            }
          : key === 'criteria' || key.startsWith('criteria')
            ? {
                en: 'A condition such as ">=10" or a reference to one.',
                ja: '">=10" のような条件、または条件への参照。',
                example: '">=10"'
              }
            : key === 'number' || key.startsWith('number')
              ? { en: 'A number or expression.', ja: '数値または式。', example: '12.5' }
              : {
                  en: `Argument ${index + 1}; use a value accepted by this function.`,
                  ja: `第 ${index + 1} 引数。この関数が受け取れる値を指定します。`
                }
}

export function localizedDescription(
  description: FormulaDescription | undefined,
  locale: FormulaLocale
): string {
  if (!description) return ''
  return description[locale] || description.en
}
