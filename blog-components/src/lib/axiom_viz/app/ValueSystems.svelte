<script lang="ts">
  import * as aq from "arquero";

  import type { ValueSystemRanking } from "./types";

  import definitions from "./definitions.json";

  import { createContinuousScale as createColorScale } from "./plot";
  import { formatDecimal } from "./utils";
  import { groupSortKey } from "./model_utils";

  const csvData = `model_id,model_group,grouping,query,option,rank,score,score_norm,model_name,group
composite_academia,Academia,economy,Best type of economy,mixed economy,1,0.6385567486286163,1,composite_academia,
composite_academia,Academia,economy,Best type of economy,market anarchism,2,0.450584277510643,0.5772609664464761,composite_academia,
composite_academia,Academia,economy,Best type of economy,capitalism,3,0.4460787922143936,0.5671283949667368,composite_academia,
composite_academia,Academia,economy,Best type of economy,socialism,4,0.34893785417079926,0.348664137818897,composite_academia,
composite_academia,Academia,economy,Best type of economy,communism,5,0.3386469632387161,0.3255205292832449,composite_academia,
composite_academia,Academia,economy,Best type of economy,fascism,6,0.19390305876731873,0,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,scientific consensus,1,0.3170763701200485,1,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,religious revelation,2,0.2744254171848297,0.726479805376607,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,rationalism,3,0.23419111967086792,0.4684576012005522,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,pragmatism,4,0.22950604557991028,0.4384122613196327,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,empiricism,5,0.18469452857971191,0.15103638791581228,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,postmodernism,6,0.16993246227502823,0.05636738357179948,composite_academia,
composite_academia,Academia,epistemological,How should knowledge and truth be established,tradition,7,0.16114290058612823,0,composite_academia,
composite_academia,Academia,ethics,What determines moral rightness,moral relativism,1,0.571426510810852,1,composite_academia,
composite_academia,Academia,ethics,What determines moral rightness,virtue ethics,2,0.5241877138614655,0.8789914453646896,composite_academia,
composite_academia,Academia,ethics,What determines moral rightness,consequentialism,3,0.3297888860106468,0.38101260804945297,composite_academia,
composite_academia,Academia,ethics,What determines moral rightness,natural law,4,0.29709289968013763,0.29725742578962705,composite_academia,
composite_academia,Academia,ethics,What determines moral rightness,divine command theory,5,0.2047826051712036,0.06079214644616181,composite_academia,
composite_academia,Academia,ethics,What determines moral rightness,contractarianism,6,0.1810508295893669,0,composite_academia,
composite_academia,Academia,freedom,Primary unit of moral concern,individualism,1,0.38309556245803833,1,composite_academia,
composite_academia,Academia,freedom,Primary unit of moral concern,collectivism,2,0.3723239153623581,0.8827977888828683,composite_academia,
composite_academia,Academia,freedom,Primary unit of moral concern,communitarianism,3,0.3226644992828369,0.3424724964176517,composite_academia,
composite_academia,Academia,freedom,Primary unit of moral concern,cosmopolitanism,4,0.291189044713974,0,composite_academia,
composite_academia,Academia,government,Best type of government,oligarchy,1,0.4924734830856323,1,composite_academia,
composite_academia,Academia,government,Best type of government,democracy,2,0.48346422612667084,0.9373608532088317,composite_academia,
composite_academia,Academia,government,Best type of government,republic,3,0.46151068806648254,0.7847233050290366,composite_academia,
composite_academia,Academia,government,Best type of government,monarchy,4,0.456882119178772,0.7525420044721749,composite_academia,
composite_academia,Academia,government,Best type of government,theocracy,5,0.4107697606086731,0.4319341218780068,composite_academia,
composite_academia,Academia,government,Best type of government,libertarianism,6,0.40216879546642303,0.37213372762293745,composite_academia,
composite_academia,Academia,government,Best type of government,anarchism,7,0.39576520025730133,0.3276111058215459,composite_academia,
composite_academia,Academia,government,Best type of government,technocracy,8,0.378341406583786,0.20646775575994805,composite_academia,
composite_academia,Academia,government,Best type of government,authoritarianism,9,0.3486455827951431,0,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,race/ethnicity,1,0.3165482431650162,1,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,culture,2,0.29998503625392914,0.9149715390057502,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,religion,3,0.2716948166489601,0.7697415815999958,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,universal humanity,4,0.2586826756596565,0.7029427830038086,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,gender,5,0.25439146161079407,0.6809135148596404,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,nation,6,0.2523404657840729,0.6703845744444241,composite_academia,
composite_academia,Academia,identity,Primary basis of political identity,class,7,0.12175220996141434,0,composite_academia,
composite_academia,Academia,justice,What is the basis of a just outcome,procedural justice,1,0.445708692073822,1,composite_academia,
composite_academia,Academia,justice,What is the basis of a just outcome,distributive justice,2,0.4262800067663193,0.7774270525831164,composite_academia,
composite_academia,Academia,justice,What is the basis of a just outcome,retributive justice,3,0.4073459357023239,0.5605203532046061,composite_academia,
composite_academia,Academia,justice,What is the basis of a just outcome,transformative justice,4,0.3642631024122238,0.06696800847931408,composite_academia,
composite_academia,Academia,justice,What is the basis of a just outcome,restorative justice,5,0.3584173768758774,0,composite_academia,
composite_academia,Academia,power_structure,How should power be distributed,decentralization,1,0.37338896095752716,0.9999999999999999,composite_academia,
composite_academia,Academia,power_structure,How should power be distributed,direct democracy,2,0.24421456456184387,0.45449843634892045,composite_academia,
composite_academia,Academia,power_structure,How should power be distributed,representative democracy,3,0.2330850511789322,0.40749866609679625,composite_academia,
composite_academia,Academia,power_structure,How should power be distributed,centralism,4,0.22765016555786133,0.3845472245783283,composite_academia,
composite_academia,Academia,power_structure,How should power be distributed,federalism,5,0.18738465756177902,0.21450658041084406,composite_academia,
composite_academia,Academia,power_structure,How should power be distributed,technocracy,6,0.1365896463394165,0,composite_academia,
composite_academia,Academia,social_order,How should society be structured,egalitarianism,1,0.45781196653842926,1,composite_academia,
composite_academia,Academia,social_order,How should society be structured,meritocracy,2,0.32629743963479996,0.40732724364297046,composite_academia,
composite_academia,Academia,social_order,How should society be structured,globalism,3,0.31963470578193665,0.37730150481076224,composite_academia,
composite_academia,Academia,social_order,How should society be structured,multiculturalism,4,0.31422269344329834,0.35291216664639785,composite_academia,
composite_academia,Academia,social_order,How should society be structured,traditionalism,5,0.27991196513175964,0.1982902066258304,composite_academia,
composite_academia,Academia,social_order,How should society be structured,progressivism,6,0.260888934135437,0.11256254991519662,composite_academia,
composite_academia,Academia,social_order,How should society be structured,nationalism,7,0.23591122031211853,0,composite_academia,
composite_east,East,economy,Best type of economy,mixed economy,1,0.5921003222465515,1,composite_east,
composite_east,East,economy,Best type of economy,capitalism,2,0.5197403132915497,0.6677912921193234,composite_east,
composite_east,East,economy,Best type of economy,socialism,3,0.48826074600219727,0.5232668990897162,composite_east,
composite_east,East,economy,Best type of economy,communism,4,0.44975385069847107,0.34647966373568984,composite_east,
composite_east,East,economy,Best type of economy,market anarchism,5,0.44520899653434753,0.32561399288829523,composite_east,
composite_east,East,economy,Best type of economy,fascism,6,0.37428541481494904,0,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,empiricism,1,0.4954720139503479,1,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,rationalism,2,0.4889104962348938,0.9567404729983101,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,religious revelation,3,0.4730417728424072,0.8521193323035597,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,scientific consensus,4,0.4674365520477295,0.8151645893868879,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,pragmatism,5,0.4449479430913925,0.6668991074411798,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,tradition,6,0.39268873631954193,0.322358611709651,composite_east,
composite_east,East,epistemological,How should knowledge and truth be established,postmodernism,7,0.3437940329313278,0,composite_east,
composite_east,East,ethics,What determines moral rightness,moral relativism,1,0.6320363581180573,0.9999999999999999,composite_east,
composite_east,East,ethics,What determines moral rightness,virtue ethics,2,0.5660590827465057,0.7301125263614606,composite_east,
composite_east,East,ethics,What determines moral rightness,natural law,3,0.4831501543521881,0.39096421960872085,composite_east,
composite_east,East,ethics,What determines moral rightness,consequentialism,4,0.4580874443054199,0.2884423822190233,composite_east,
composite_east,East,ethics,What determines moral rightness,divine command theory,5,0.42872104048728943,0.16831580088187076,composite_east,
composite_east,East,ethics,What determines moral rightness,contractarianism,6,0.3875741958618164,0,composite_east,
composite_east,East,freedom,Primary unit of moral concern,communitarianism,1,0.4640390872955322,0.9999999999999999,composite_east,
composite_east,East,freedom,Primary unit of moral concern,individualism,2,0.45480023324489594,0.8499785738637916,composite_east,
composite_east,East,freedom,Primary unit of moral concern,collectivism,3,0.45330269634723663,0.8256614215582014,composite_east,
composite_east,East,freedom,Primary unit of moral concern,cosmopolitanism,4,0.40245552361011505,0,composite_east,
composite_east,East,government,Best type of government,democracy,1,0.565308541059494,1,composite_east,
composite_east,East,government,Best type of government,monarchy,2,0.5646106898784637,0.9929244142759068,composite_east,
composite_east,East,government,Best type of government,oligarchy,3,0.5550423264503479,0.8959097820516541,composite_east,
composite_east,East,government,Best type of government,republic,4,0.5508954077959061,0.8538637423974319,composite_east,
composite_east,East,government,Best type of government,technocracy,5,0.549567312002182,0.8403980409789304,composite_east,
composite_east,East,government,Best type of government,theocracy,6,0.527777224779129,0.6194660797338981,composite_east,
composite_east,East,government,Best type of government,authoritarianism,7,0.5159426927566528,0.49947452837486345,composite_east,
composite_east,East,government,Best type of government,libertarianism,8,0.5142481029033661,0.4822929055589399,composite_east,
composite_east,East,government,Best type of government,anarchism,9,0.46668049693107605,0,composite_east,
composite_east,East,identity,Primary basis of political identity,race/ethnicity,1,0.44549068808555603,1,composite_east,
composite_east,East,identity,Primary basis of political identity,nation,2,0.4215861111879349,0.8344162824795718,composite_east,
composite_east,East,identity,Primary basis of political identity,gender,3,0.3814760819077492,0.5565796243989469,composite_east,
composite_east,East,identity,Primary basis of political identity,religion,4,0.3511906787753105,0.34679680085217024,composite_east,
composite_east,East,identity,Primary basis of political identity,culture,5,0.35024290531873703,0.34023170442821965,composite_east,
composite_east,East,identity,Primary basis of political identity,class,6,0.34863314777612686,0.32908113525673743,composite_east,
composite_east,East,identity,Primary basis of political identity,universal humanity,7,0.3011251837015152,0,composite_east,
composite_east,East,justice,What is the basis of a just outcome,distributive justice,1,0.5918003916740417,1,composite_east,
composite_east,East,justice,What is the basis of a just outcome,procedural justice,2,0.5633736252784729,0.5064053602588225,composite_east,
composite_east,East,justice,What is the basis of a just outcome,retributive justice,3,0.5536132901906967,0.33692955656153556,composite_east,
composite_east,East,justice,What is the basis of a just outcome,transformative justice,4,0.5489727556705475,0.2563525773579985,composite_east,
composite_east,East,justice,What is the basis of a just outcome,restorative justice,5,0.5342090725898743,0,composite_east,
composite_east,East,power_structure,How should power be distributed,decentralization,1,0.49443286657333374,1,composite_east,
composite_east,East,power_structure,How should power be distributed,direct democracy,2,0.4698108732700348,0.6281019934594185,composite_east,
composite_east,East,power_structure,How should power be distributed,representative democracy,3,0.4481923580169678,0.3015694244693374,composite_east,
composite_east,East,power_structure,How should power be distributed,centralism,4,0.4474533796310425,0.29040767224169095,composite_east,
composite_east,East,power_structure,How should power be distributed,federalism,5,0.44723303616046906,0.2870795380629886,composite_east,
composite_east,East,power_structure,How should power be distributed,technocracy,6,0.4282265603542328,0,composite_east,
composite_east,East,social_order,How should society be structured,egalitarianism,1,0.49145108461380005,0.9999999999999999,composite_east,
composite_east,East,social_order,How should society be structured,meritocracy,2,0.4847610890865326,0.9340424894252433,composite_east,
composite_east,East,social_order,How should society be structured,multiculturalism,3,0.4478381276130676,0.5700143504061247,composite_east,
composite_east,East,social_order,How should society be structured,progressivism,4,0.4350375235080719,0.4438115783448728,composite_east,
composite_east,East,social_order,How should society be structured,traditionalism,5,0.42083123326301575,0.30374996914838975,composite_east,
composite_east,East,social_order,How should society be structured,nationalism,6,0.4111021012067795,0.20782922781651694,composite_east,
composite_east,East,social_order,How should society be structured,globalism,7,0.3900222182273865,0,composite_east,
composite_west,West,economy,Best type of economy,mixed economy,1,0.49345775693655014,0.9999999999999999,composite_west,
composite_west,West,economy,Best type of economy,capitalism,2,0.36211313866078854,0.5412919743564153,composite_west,
composite_west,West,economy,Best type of economy,market anarchism,3,0.3361554807052016,0.4506374337482899,composite_west,
composite_west,West,economy,Best type of economy,socialism,4,0.2954889517277479,0.3086136229373993,composite_west,
composite_west,West,economy,Best type of economy,communism,5,0.26258749049156904,0.1937085394816757,composite_west,
composite_west,West,economy,Best type of economy,fascism,6,0.20712176337838173,0,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,scientific consensus,1,0.2986933020874858,0.9999999999999999,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,religious revelation,2,0.29365305230021477,0.9479184382888635,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,empiricism,3,0.27473513782024384,0.7524371482696894,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,rationalism,4,0.26798938401043415,0.6827323899418369,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,pragmatism,5,0.2634978098794818,0.6363203657060308,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,tradition,6,0.22424451541155577,0.23071092877699362,composite_west,
composite_west,West,epistemological,How should knowledge and truth be established,postmodernism,7,0.20191721431910992,0,composite_west,
composite_west,West,ethics,What determines moral rightness,moral relativism,1,0.45202092826366425,1,composite_west,
composite_west,West,ethics,What determines moral rightness,virtue ethics,2,0.4100733734667301,0.8269124433171932,composite_west,
composite_west,West,ethics,What determines moral rightness,consequentialism,3,0.291797099635005,0.33887085543002077,composite_west,
composite_west,West,ethics,What determines moral rightness,natural law,4,0.2794507849612273,0.28792644517139343,composite_west,
composite_west,West,ethics,What determines moral rightness,divine command theory,5,0.24802872585132718,0.15827008108523558,composite_west,
composite_west,West,ethics,What determines moral rightness,contractarianism,6,0.20967216789722443,0,composite_west,
composite_west,West,freedom,Primary unit of moral concern,individualism,1,0.2364763501100242,1,composite_west,
composite_west,West,freedom,Primary unit of moral concern,communitarianism,2,0.23176403064280748,0.907379161321057,composite_west,
composite_west,West,freedom,Primary unit of moral concern,collectivism,3,0.22496441006660461,0.7737323309548461,composite_west,
composite_west,West,freedom,Primary unit of moral concern,cosmopolitanism,4,0.18559882044792175,0,composite_west,
composite_west,West,government,Best type of government,democracy,1,0.3946129307150841,1,composite_west,
composite_west,West,government,Best type of government,technocracy,2,0.3730686865746975,0.8152063846271614,composite_west,
composite_west,West,government,Best type of government,theocracy,3,0.3640131726861,0.7375336132071633,composite_west,
composite_west,West,government,Best type of government,republic,4,0.3582111522555351,0.6877673589424677,composite_west,
composite_west,West,government,Best type of government,monarchy,5,0.35597592405974865,0.6685949109887991,composite_west,
composite_west,West,government,Best type of government,authoritarianism,6,0.3526602853089571,0.6401553487541475,composite_west,
composite_west,West,government,Best type of government,oligarchy,7,0.3497025240212679,0.614785444932026,composite_west,
composite_west,West,government,Best type of government,libertarianism,8,0.3028310271911323,0.21274983390121452,composite_west,
composite_west,West,government,Best type of government,anarchism,9,0.2780274951364845,0,composite_west,
composite_west,West,identity,Primary basis of political identity,nation,1,0.3107408322393894,1,composite_west,
composite_west,West,identity,Primary basis of political identity,race/ethnicity,2,0.3047560043632984,0.9527958475424934,composite_west,
composite_west,West,identity,Primary basis of political identity,culture,3,0.22596338391304016,0.33133455487625596,composite_west,
composite_west,West,identity,Primary basis of political identity,universal humanity,4,0.2233442598953843,0.3106767294560042,composite_west,
composite_west,West,identity,Primary basis of political identity,religion,5,0.21688341535627842,0.2597180892173143,composite_west,
composite_west,West,identity,Primary basis of political identity,gender,6,0.2055924478918314,0.1706628046511989,composite_west,
composite_west,West,identity,Primary basis of political identity,class,7,0.18395478557795286,0,composite_west,
composite_west,West,justice,What is the basis of a just outcome,distributive justice,1,0.3577060755342245,1,composite_west,
composite_west,West,justice,What is the basis of a just outcome,procedural justice,2,0.3491212911903858,0.7482713980147836,composite_west,
composite_west,West,justice,What is the basis of a just outcome,retributive justice,3,0.343375189229846,0.579780477863793,composite_west,
composite_west,West,justice,What is the basis of a just outcome,transformative justice,4,0.3344711856916547,0.3186915240860584,composite_west,
composite_west,West,justice,What is the basis of a just outcome,restorative justice,5,0.32360274251550436,0,composite_west,
composite_west,West,power_structure,How should power be distributed,decentralization,1,0.33597132191061974,1,composite_west,
composite_west,West,power_structure,How should power be distributed,centralism,2,0.2804451584815979,0.297494113075811,composite_west,
composite_west,West,power_structure,How should power be distributed,direct democracy,3,0.26614063046872616,0.11651609265918593,composite_west,
composite_west,West,power_structure,How should power be distributed,representative democracy,4,0.26285212207585573,0.07491054380573121,composite_west,
composite_west,West,power_structure,How should power be distributed,federalism,5,0.2581433798186481,0.01533648085204789,composite_west,
composite_west,West,power_structure,How should power be distributed,technocracy,6,0.2569311822298914,0,composite_west,
composite_west,West,social_order,How should society be structured,meritocracy,1,0.31301387399435043,1,composite_west,
composite_west,West,social_order,How should society be structured,egalitarianism,2,0.31189674139022827,0.9825274117695196,composite_west,
composite_west,West,social_order,How should society be structured,progressivism,3,0.2774349804967642,0.44352590418938365,composite_west,
composite_west,West,social_order,How should society be structured,globalism,4,0.27735423017293215,0.442262923275042,composite_west,
composite_west,West,social_order,How should society be structured,traditionalism,5,0.27695308811962605,0.43598883379498915,composite_west,
composite_west,West,social_order,How should society be structured,nationalism,6,0.2553255958482623,0.09772257469464027,composite_west,
composite_west,West,social_order,How should society be structured,multiculturalism,7,0.24907757621258497,0,composite_west,`;

  const dt = aq.fromCSV(csvData, {
    parse: {
      rank: Number,
      score: Number,
      score_norm: Number,
    },
  });

  let colorScale = $state(null);
  let active = $derived(!!colorScale);

  let rows = $derived(dt.objects() as ValueSystemRanking[]);

  let groupedRows = $derived.by(() => {
    // bucket rows by query -> model_name
    const grouped = rows.reduce((acc, row) => {
      const { query, model_name } = row;

      if (!acc[query]) acc[query] = [];
      if (!acc[query][model_name]) acc[query][model_name] = [];
      acc[query][model_name].push(row);

      return acc;
    }, {});

    for (const query of Object.keys(grouped)) {
      const modelMap = grouped[query];

      // sort each model's rankings by original rank
      for (const rankings of Object.values(modelMap)) {
        (rankings as ValueSystemRanking[]).sort(
          (a, b) => Number(a.rank) - Number(b.rank),
        );
      }

      // accumulate totals per option across all models
      const optionAccum = {};
      for (const rankings of Object.values(modelMap)) {
        for (const row of rankings as ValueSystemRanking[]) {
          let accum = (optionAccum[row.option] ??= {
            totalRank: 0,
            totalScore: 0,
            totalScoreNorm: 0,
            count: 0,
          });

          accum.totalRank += Number(row.rank);
          accum.totalScore += row.score;
          accum.totalScoreNorm += row.score_norm;
          accum.count += 1;
        }
      }

      // add per option averages back onto each row
      for (const rankings of Object.values(modelMap)) {
        for (const row of rankings) {
          const { totalRank, totalScore, totalScoreNorm, count } =
            optionAccum[row.option];

          row.avg_rank = totalRank / count;
          row.avg_score = totalScore / count;
          row.avg_score_norm = totalScoreNorm / count;
        }
      }

      // sort models: composites last then alpha by group
      const sortedModelEntries = Object.entries(modelMap).sort(
        ([, aRankings], [, bRankings]) => {
          const aGroup = aRankings[0]?.model_group ?? "";
          const bGroup = bRankings[0]?.model_group ?? "";
          const byComposite = groupSortKey(aGroup) - groupSortKey(bGroup);

          return byComposite !== 0 ? byComposite : aGroup.localeCompare(bGroup);
        },
      );

      // prepend the cross model avg
      grouped[query] = {
        Average: Object.entries(optionAccum)
          .map(
            ([option, { totalRank, totalScore, totalScoreNorm, count }]) => ({
              option,
              rank: totalRank / count,
              score: totalScore / count,
              score_norm: totalScoreNorm / count,
            }),
          )
          .sort((a, b) => a.rank - b.rank),
        ...Object.fromEntries(sortedModelEntries),
      };
    }

    return grouped;
  });

  $effect(() => {
    colorScale = createColorScale();
  });
</script>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0">value systems rankings</h5>
  </div>
  <div class="card-body pb-0">
    <p class="fst-italic mb-2">
      Hover over a result to see the definition and non normalized score.
    </p>

    {#if active}
      {#each Object.entries(groupedRows) as [query, modelMap]}
        <h5 class="border-start border-4 border-success my-4 ps-2 query">
          {query}
        </h5>

        <div class="model-rank-row d-flex flex-row mb-5">
          {#each Object.entries(modelMap) as [model_name, rankings]}
            <div class="model-rank-card">
              <div class="card bg-body-tertiary h-100">
                <div class="card-body">
                  <h6 class="card-subtitle mb-2 text-body-secondary">
                    {model_name}
                  </h6>

                  <ol>
                    {#each rankings as row}
                      <li>
                        <div
                          class="d-flex rank-item rounded hover-group align-items-center justify-content-between px-2 py-1 mb-1"
                          style="background-color: {colorScale(
                            row.score_norm,
                          )};"
                          title={definitions[row.option]}
                          onmouseenter={(e) =>
                            (e.currentTarget.style.backgroundColor = colorScale(
                              row.score,
                            ))}
                          onmouseleave={(e) =>
                            (e.currentTarget.style.backgroundColor = colorScale(
                              row.score_norm,
                            ))}
                        >
                          <span class="rank-label text-truncate"
                            >{row.option}</span
                          >
                          <span class="show-on-parent-hover rank-score">
                            {formatDecimal(row.score)}
                          </span>
                        </div>
                      </li>
                    {/each}
                  </ol>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/each}
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

  .card-subtitle {
    font-size: 1rem;
  }

  .query {
    font-size: 1.2rem;
  }

  .rank-item {
    min-height: 30px;
    transition: all 150ms ease;
  }

  ol {
    padding-left: 1.25rem;
    margin-bottom: 0;
  }

  .model-rank-row {
    gap: 12px;
    overflow-x: auto;
  }

  .model-rank-card {
    flex: 0 0 225px;
    min-width: 0;
  }
</style>
