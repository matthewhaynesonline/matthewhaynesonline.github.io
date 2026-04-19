<script lang="ts">
  import * as aq from "arquero";

  import config from "./config.json";
  import { createContinuousSentimentScale as createColorScale } from "./plot";
  import { changeSort } from "./utils";
  import { getDisplayScore } from "./ui/ui_utils";

  import SortIcon from "./ui/SortIcon.svelte";
  import ScoreVal from "./ui/ScoreVal.svelte";

  const csvData = `a_term,a_category,b_category,positive_term,negative_term,avg_score,composite_academia,composite_east,composite_west
Public goods,political_economic,composite_judgement_average,composite_positive,composite_negative,0.3893507029868929,0.2811522049208482,0.34996945535143215,0.4778985504077961
Free trade,political_economic,composite_judgement_average,composite_positive,composite_negative,0.34029772774683253,0.28444503620266914,0.41416006550813717,0.32949194001654786
Universal Basic Income,political_economic,composite_judgement_average,composite_positive,composite_negative,0.30532587424033525,0.1717381508400043,0.3838750449940562,0.33834900582830113
Social democracy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.2907146687696999,0.1458663142596682,0.4074256041397651,0.30759712025367963
Sovereign wealth fund,political_economic,composite_judgement_average,composite_positive,composite_negative,0.27195594798434863,0.10632163084422548,0.29804549071316916,0.3556828126311302
Trade surplus,political_economic,composite_judgement_average,composite_positive,composite_negative,0.2480615790912204,0.08091089699883014,0.3297443917642037,0.2993423007428646
Libertarianism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.22357529809144605,0.0350669693822662,0.31057354471219395,0.2844813473445053
Subsidy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.21392548807842,0.134966935031116,0.3446060206430654,0.18289230036801504
Welfare state,political_economic,composite_judgement_average,composite_positive,composite_negative,0.20967582344768962,0.1449928308914726,0.3007061750007172,0.1938674080496033
Progressive taxation,political_economic,composite_judgement_average,composite_positive,composite_negative,0.20875436634841293,0.18527055531740189,0.24911952453354994,0.1986255580559373
Property rights,political_economic,composite_judgement_average,composite_positive,composite_negative,0.19026949919873112,0.21478741150349379,0.1657532143096129,0.1902685227493445
Socialism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.16420765166791776,-0.07627774076536298,0.19649340755616626,0.28912743359493714
Industrial policy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.1386903083713895,0.19900575885549188,0.10707140690647066,0.12147237895987928
Market economy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.13777616078203375,0.18760455710192522,0.10765914378377299,0.12594933318905532
Quantitative easing,political_economic,composite_judgement_average,composite_positive,composite_negative,0.13615272618181098,-0.0056557683274149895,0.22739677030282715,0.1664913964147369
Fiscal policy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.1290186157619411,0.12995869192915657,0.1542028666784366,0.11334401951171458
Monetary policy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.1283866816136817,0.08557837941528608,0.15622054296545684,0.13737134612165391
Financialization,political_economic,composite_judgement_average,composite_positive,composite_negative,0.12538409042242687,0.1776972028116385,0.12744454965771487,0.09275994744772713
Planned economy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.12511159512073255,0.06794017398109038,0.2806144133210182,0.06611275688434641
State capitalism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.1211191865502659,0.11806529139479001,0.14632498876502117,0.1078280423146983
Protectionism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.1147418977361116,0.11476883296078692,0.0499170048472782,0.15362067233460644
Monetarism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.09191911188518685,-0.1773257919897636,0.1947247845431169,0.1917826506153991
Capital controls,political_economic,composite_judgement_average,composite_positive,composite_negative,0.09099731564338347,0.1778786190552637,0.0708668720908463,0.05094679972777764
Gig economy,political_economic,composite_judgement_average,composite_positive,composite_negative,0.09025107444066442,0.27164486919840175,-0.057684375594059624,0.07017606760685642
Mercantilism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.09008531600314502,0.021606359630823135,0.0916228304655912,0.13025018114907047
Gini coefficient,political_economic,composite_judgement_average,composite_positive,composite_negative,0.07006710201544178,-0.06748976993064086,0.23734106992681822,0.05223684443626553
Globalization,political_economic,composite_judgement_average,composite_positive,composite_negative,0.06819325766639049,-0.008998117254426083,0.14538535312749445,0.06819282534221809
Labor unionism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.04913405975446837,-0.020428644105171163,0.04400071625908216,0.09395168816748385
Microfinance,political_economic,composite_judgement_average,composite_positive,composite_negative,0.04879870039947105,0.010063672438263893,0.12029106883953015,0.02914429611215989
Economic nationalism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.03561122899268274,0.13135293603409082,-0.01713817814985911,0.009815849053363005
Keynesianism,political_economic,composite_judgement_average,composite_positive,composite_negative,0.031079050873152228,-0.12991525419056416,0.07155042545249064,0.10339280916377902
Tariff,political_economic,composite_judgement_average,composite_positive,composite_negative,0.020345616768198932,0.04017852277805408,0.049515599462514125,-0.009056116454303265
Capital flight,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.002800372147414071,0.0005214797953764597,-0.1518341228365898,0.08462676710041706
Rent seeking,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.008761179513495528,-0.08388687732319038,-0.2485680760194858,0.18019837707591554
Currency peg,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.021675682283592197,0.06785635401805241,0.04113032203167677,-0.11307850665374038
Capitalism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.03248322964116762,-0.12081696341435115,0.020019129539529484,-0.010984404885675758
Corporatism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.04538700691156202,-0.38120970626672107,0.10328066349029541,0.06690601046041895
Mixed economy,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.10738636798818003,0.2078456807260712,-0.10342723752061526,-0.29890107549726963
Communism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.10810900213563758,-0.003332658981283506,-0.05686985809976856,-0.20171829444977143
Neoliberalism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.13240042852350709,-0.22545414262761673,-0.20033216600616774,-0.035809157571444906
Sovereign debt,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.15348024934417373,-0.25237655205031234,0.05860078241676092,-0.2213910867770513
Informal economy,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.18666633133861152,0.08432832298179467,-0.4890269413590431,-0.16784675791859627
Regressive taxation,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.22644366186895326,-0.1041723230543236,-0.31686898941795033,-0.24555126862833276
Externalities,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.23774077000350438,-0.18951127088318268,-0.33025337507327396,-0.21117090643383563
Austerity,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.2674729330800333,-0.2521666817289467,-0.35717502360542613,-0.22283542957544947
Deregulation,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.28245132793954597,0.1477514337748289,-0.46982350821296376,-0.42814967680412036
Anarchism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.34085210068433575,-0.1971758296713233,-0.33688345178961754,-0.42943905262897414
Income inequality,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.37363503234210477,-0.17930467054247856,-0.5243365106483301,-0.3998123624381454
Trade deficit,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.38809502399244317,-0.18027989418866733,-0.3408718875919779,-0.5411179837149879
Shadow banking,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.40619254565205093,-0.23727384566639861,-0.40400607138872147,-0.5088556502014399
Embargo,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.4106644068449509,-0.2666100561618805,-0.42028957419097424,-0.49132191684717935
Fascism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.4164288666630234,-0.4599770367300759,-0.3987796337654193,-0.40088950436135445
Crony capitalism,political_economic,composite_judgement_average,composite_positive,composite_negative,-0.42892663464127423,-0.350937529001385,-0.5575508438050747,-0.39854557252692757`;

  const dt = aq.fromCSV(csvData);

  const models = [
    { model_id: "composite_academia", model_name: "Academia" },
    { model_id: "composite_east", model_name: "East" },
    { model_id: "composite_west", model_name: "West" },
  ];

  const avg_score_column = "avg_score";

  // These were driven by selectedJudgementTermsCategory in the original;
  // since the CSV has a single fixed judgement category, pull from first row.
  const firstRow = dt.object(0);
  const positiveTerm = firstRow?.positive_term ?? null;
  const negativeTerm = firstRow?.negative_term ?? null;
  const selectedTermCategory = firstRow?.a_category ?? null;

  let colorScale = $state(null);
  let active = $derived(!!colorScale);

  let sortColumn = $state(avg_score_column);
  let sortDesc = $state(true);

  let sortAqColumn = $derived(sortDesc ? aq.desc(sortColumn) : sortColumn);
  let sortedDt = $derived(dt.orderby(sortAqColumn));
  let rows = $derived(sortedDt.objects());

  let title = $derived.by(() => {
    let t = selectedTermCategory ?? "All";
    if (positiveTerm && negativeTerm) {
      t += `: "${positiveTerm}" vs "${negativeTerm}"`;
    }
    return t;
  });

  $effect(() => {
    colorScale = createColorScale();
  });

  function doChangeSort(column: string) {
    [sortColumn, sortDesc] = changeSort(sortColumn, sortDesc, column);
  }
</script>

{#snippet sortHeader(columnId: string, label: string, extraClass: string = "")}
  <th
    scope="col"
    class="cursor-pointer {config.theme.headingCssClasses} {extraClass}"
    onclick={() => doChangeSort(columnId)}
  >
    <div>
      {label}
      <SortIcon active={sortColumn === columnId} {sortDesc} />
    </div>
  </th>
{/snippet}

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">political_economic: composites heatmap</h5>
  </div>
  <div class="card-body pt-0">
    {#if active}
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr class="text-wrap text-break">
              {@render sortHeader("a_term", "Term", "text-end pe-3")}

              {#each models ?? [] as model}
                {@render sortHeader(model.model_id, model.model_name, "angled")}
              {/each}

              {@render sortHeader(avg_score_column, "All Average", "angled")}
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class="align-middle">
                <td class="text-end pe-3">
                  {row.a_term}
                  <!-- {#if !selectedJudgementTermsCategory && row.positive_term && row.negative_term}
                ({row.positive_term} vs {row.negative_term})
              {/if} -->
                </td>

                {#each models ?? [] as model}
                  <td class="text-center p-1">
                    <div
                      class="rounded hover-group"
                      style="background-color: {colorScale(
                        row[model.model_id],
                      )};"
                    >
                      <span class="show-on-parent-hover">
                        {getDisplayScore(row[model.model_id])}
                      </span>
                    </div>
                  </td>
                {/each}

                <td>
                  <ScoreVal score={row[avg_score_column]} />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    font-size: 0.9rem;
  }

  .card-body {
    max-height: 600px;
    overflow-y: scroll;
  }

  th.angled {
    height: 100px;
    vertical-align: bottom;
  }

  th.angled > div {
    transform: rotate(-35deg);
    transform-origin: left bottom;
    width: 75px;
    white-space: nowrap;
  }
</style>
