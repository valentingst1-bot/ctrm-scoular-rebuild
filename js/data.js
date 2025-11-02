(function () {
  const utils = window.CTRMUtils;
  const valuationFactory = window.CTRMValuationEngine;

  const CONTRACT_MULTIPLIERS = {
    Soybeans: 5000,
    Corn: 5000,
    Wheat: 5000,
    Canola: 100,
  };

  const COMMODITY_SYMBOL = {
    Soybeans: 'ZS',
    Corn: 'ZC',
    Wheat: 'ZW',
    Canola: 'RS',
  };

  const SNAPSHOT_TEMPLATES = {
    today: {
      label: 'Live',
      bulletins: [
        'Soy crush margins expanded 14% on stronger meal demand.',
        'Canadian canola basis tightening in Prairie North zone.',
        'Barge freight easing, reducing exposure on Mississippi lifts.'
      ],
      dataset: {
        trades: [
          {
            id: 'SC-3101',
            counterparty: 'ADM',
            type: 'Purchase',
            commodity: 'Soybeans',
            qty: 2150000,
            unpricedQty: 1850000,
            uom: 'bu',
            marketMonth: 'Nov-24',
            pricingPoint: 'Fargo Elevator',
            marketZone: 'Prairie North',
            basis: 0.24,
            futuresPrice: 13.22,
            contractLocalPrice: 13.46,
            deliveryWindow: 'Sep 12 - Sep 20',
            status: 'Open',
            freightAccrual: { reserved: 42000, actual: null, zoneVariance: -3200 },
          },
          {
            id: 'SC-3102',
            counterparty: 'Cargill',
            type: 'Sale',
            commodity: 'Wheat',
            qty: 1750000,
            unpricedQty: 1450000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
            basis: 0.31,
            futuresPrice: 7.44,
            contractLocalPrice: 7.86,
            deliveryWindow: 'Oct 01 - Oct 15',
            status: 'Nominated',
            freightAccrual: { reserved: 38000, actual: 34200, zoneVariance: -2100 },
          },
          {
            id: 'SC-3103',
            counterparty: 'Louis Dreyfus',
            type: 'Purchase',
            commodity: 'Corn',
            qty: 2400000,
            unpricedQty: 2100000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Memphis Barge',
            marketZone: 'Mississippi River',
            basis: 0.17,
            futuresPrice: 5.08,
            contractLocalPrice: 5.39,
            deliveryWindow: 'Sep 25 - Oct 05',
            status: 'Working',
            freightAccrual: { reserved: 28500, actual: null, zoneVariance: 0 },
          },
          {
            id: 'SC-3104',
            counterparty: 'COFCO',
            type: 'Sale',
            commodity: 'Canola',
            qty: 132000,
            unpricedQty: 102000,
            uom: 'mt',
            marketMonth: 'Jan-25',
            pricingPoint: 'Winnipeg Crush',
            marketZone: 'Prairie North',
            basis: 24,
            futuresPrice: 690,
            contractLocalPrice: 700,
            deliveryWindow: 'Nov 05 - Nov 20',
            status: 'Confirmed',
            freightAccrual: { reserved: 46000, actual: 49800, zoneVariance: -1800 },
          },
          {
            id: 'SC-3105',
            counterparty: 'The Andersons',
            type: 'Purchase',
            commodity: 'Corn',
            qty: 1800000,
            unpricedQty: 1200000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
            basis: 0.21,
            futuresPrice: 5.1,
            contractLocalPrice: 5.63,
            deliveryWindow: 'Sep 15 - Sep 22',
            status: 'Open',
            freightAccrual: { reserved: 25500, actual: null, zoneVariance: -1500 },
          },
          {
            id: 'SC-3106',
            counterparty: 'Bunge',
            type: 'Sale',
            commodity: 'Soybeans',
            qty: 2050000,
            unpricedQty: 1500000,
            uom: 'bu',
            marketMonth: 'Nov-24',
            pricingPoint: 'Fargo Elevator',
            marketZone: 'Prairie North',
            basis: 0.27,
            futuresPrice: 13.19,
            contractLocalPrice: 13.58,
            deliveryWindow: 'Oct 18 - Oct 30',
            status: 'Working',
            freightAccrual: { reserved: 33500, actual: null, zoneVariance: -2200 },
          },
          {
            id: 'SC-3107',
            counterparty: 'CHS',
            type: 'Purchase',
            commodity: 'Wheat',
            qty: 1500000,
            unpricedQty: 950000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Northern Rail',
            marketZone: 'Northern Plains',
            basis: 0.26,
            futuresPrice: 7.41,
            contractLocalPrice: 7.74,
            deliveryWindow: 'Sep 05 - Sep 18',
            status: 'Open',
            freightAccrual: { reserved: 31200, actual: null, zoneVariance: -900 },
          },
          {
            id: 'SC-3108',
            counterparty: 'Marubeni',
            type: 'Sale',
            commodity: 'Corn',
            qty: 2100000,
            unpricedQty: 900000,
            uom: 'bu',
            marketMonth: 'Mar-25',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
            basis: 0.24,
            futuresPrice: 5.26,
            contractLocalPrice: 5.86,
            deliveryWindow: 'Dec 01 - Dec 20',
            status: 'Confirmed',
            freightAccrual: { reserved: 40100, actual: 38450, zoneVariance: -1200 },
          },
          {
            id: 'SC-3109',
            counterparty: 'Gavilon',
            type: 'Purchase',
            commodity: 'Canola',
            qty: 118000,
            unpricedQty: 88000,
            uom: 'mt',
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Terminal',
            marketZone: 'Prairie South',
            basis: 21,
            futuresPrice: 684,
            contractLocalPrice: 694,
            deliveryWindow: 'Sep 01 - Sep 12',
            status: 'Working',
            freightAccrual: { reserved: 38200, actual: null, zoneVariance: -1450 },
          },
          {
            id: 'SC-3110',
            counterparty: 'Tyson Foods',
            type: 'Sale',
            commodity: 'Soybeans',
            qty: 1600000,
            unpricedQty: 620000,
            uom: 'bu',
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Shuttle',
            marketZone: 'Prairie North',
            basis: 0.29,
            futuresPrice: 13.24,
            contractLocalPrice: 13.65,
            deliveryWindow: 'Nov 01 - Nov 14',
            status: 'Nominated',
            freightAccrual: { reserved: 29800, actual: null, zoneVariance: -2500 },
          },
        ],
        inventoryLots: [
          {
            id: 'LOT-2001',
            commodity: 'Soybeans',
            qty: 850000,
            uom: 'bu',
            elevator: 'Fargo Elevator',
            grade: 'No.1',
            moisture: 11.2,
            protein: 35.5,
            startDate: '2024-07-02',
            carryingPrice: 13.18,
            marketMonth: 'Nov-24',
            pricingPoint: 'Fargo Elevator',
            marketZone: 'Prairie North',
          },
          {
            id: 'LOT-2002',
            commodity: 'Corn',
            qty: 1020000,
            uom: 'bu',
            elevator: 'Memphis Barge',
            grade: 'No.2 Yellow',
            moisture: 14.1,
            protein: 8.7,
            startDate: '2024-06-18',
            carryingPrice: 5.02,
            marketMonth: 'Dec-24',
            pricingPoint: 'Memphis Barge',
            marketZone: 'Mississippi River',
          },
          {
            id: 'LOT-2003',
            commodity: 'Wheat',
            qty: 640000,
            uom: 'bu',
            elevator: 'Gulf Elevation',
            grade: 'HRW 12% Protein',
            moisture: 12.8,
            protein: 12.2,
            startDate: '2024-07-28',
            carryingPrice: 7.32,
            marketMonth: 'Dec-24',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
          },
          {
            id: 'LOT-2004',
            commodity: 'Canola',
            qty: 52000,
            uom: 'mt',
            elevator: 'Regina Crush',
            grade: 'Canola 1 Canada',
            moisture: 9.6,
            protein: 21.4,
            startDate: '2024-05-11',
            carryingPrice: 682,
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Terminal',
            marketZone: 'Prairie South',
          },
          {
            id: 'LOT-2005',
            commodity: 'Soybeans',
            qty: 540000,
            uom: 'bu',
            elevator: 'Prairie Shuttle',
            grade: 'No.1',
            moisture: 10.9,
            protein: 34.8,
            startDate: '2024-08-06',
            carryingPrice: 13.2,
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Shuttle',
            marketZone: 'Prairie North',
          },
          {
            id: 'LOT-2006',
            commodity: 'Corn',
            qty: 460000,
            uom: 'bu',
            elevator: 'Gulf Elevation',
            grade: 'No.2 Yellow',
            moisture: 13.4,
            protein: 9.1,
            startDate: '2024-08-12',
            carryingPrice: 5.15,
            marketMonth: 'Mar-25',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
          },
        ],
        futuresPositions: [
          { id: 'FUT-001', symbol: 'ZS', commodity: 'Soybeans', month: 'Nov-24', qty: -180, avgPrice: 13.18 },
          { id: 'FUT-002', symbol: 'ZC', commodity: 'Corn', month: 'Dec-24', qty: -140, avgPrice: 5.04 },
          { id: 'FUT-003', symbol: 'ZW', commodity: 'Wheat', month: 'Dec-24', qty: -90, avgPrice: 7.28 },
          { id: 'FUT-004', symbol: 'RS', commodity: 'Canola', month: 'Jan-25', qty: -110, avgPrice: 688 },
        ],
        pricing: {
          marketPrices: {
            Soybeans: { 'Nov-24': 13.41, 'Jan-25': 13.08 },
            Corn: { 'Dec-24': 5.18, 'Mar-25': 5.31 },
            Wheat: { 'Dec-24': 7.46, 'Mar-25': 7.59 },
            Canola: { 'Nov-24': 698, 'Jan-25': 702 },
          },
          pricingPoints: {
            'Fargo Elevator': { Soybeans: 0.24 },
            'Memphis Barge': { Corn: 0.14 },
            'Gulf Elevation': { Corn: 0.18, Wheat: 0.27 },
            'Winnipeg Crush': { Canola: 5.6 },
            'Prairie Shuttle': { Soybeans: 0.27 },
            'Prairie Terminal': { Canola: 4.2 },
            'Northern Rail': { Wheat: 0.19 },
          },
          zoneSpreads: {
            'Prairie North': { Soybeans: -0.06, Canola: -4.5 },
            'Prairie South': { Canola: -3.2 },
            'Gulf Export': { Corn: 0.24, Wheat: 0.35 },
            'Mississippi River': { Corn: 0.2 },
            'Pacific Northwest': { Wheat: 0.28, Canola: -2.8 },
            'Northern Plains': { Wheat: 0.16 },
          },
        },
        adjustments: {
          other: 420000,
          workingCapitalBase: 78500000,
          futuresRealized: 0,
        },
        openTickets: [
          { id: 'TK-SC-3101A', tradeId: 'SC-3101', commodity: 'Soybeans', qty: 180000, uom: 'bu', elevator: 'Fargo Elevator', marketZone: 'Prairie North', status: 'Open' },
          { id: 'TK-SC-3103B', tradeId: 'SC-3103', commodity: 'Corn', qty: 220000, uom: 'bu', elevator: 'Memphis Barge', marketZone: 'Mississippi River', status: 'Open' },
          { id: 'TK-SC-3104A', tradeId: 'SC-3104', commodity: 'Canola', qty: 18000, uom: 'mt', elevator: 'Regina Crush', marketZone: 'Prairie North', status: 'Open' },
          { id: 'TK-SC-3108C', tradeId: 'SC-3108', commodity: 'Corn', qty: 260000, uom: 'bu', elevator: 'Gulf Elevation', marketZone: 'Gulf Export', status: 'Open' },
        ],
        referenceData: {
          Commodities: ['Soybeans', 'Corn', 'Wheat', 'Canola'],
          'Trade Units': ['bu', 'mt'],
          Elevators: ['Fargo Elevator', 'Memphis Barge', 'Gulf Elevation', 'Prairie Shuttle', 'Regina Crush'],
          'Market Zones': ['Prairie North', 'Prairie South', 'Gulf Export', 'Mississippi River', 'Pacific Northwest'],
        },
      },
    },
    monthEndAug: {
      label: 'Month End Aug',
      bulletins: [
        'August books locked: wheat carry softened 4¢ across Gulf.',
        'Soy export pace trending 8% above seasonal norms.',
        'Northern Plains basis inverted; review storage strategy.'
      ],
      dataset: {
        trades: [
          {
            id: 'SC-2201',
            counterparty: 'ADM',
            type: 'Purchase',
            commodity: 'Soybeans',
            qty: 1980000,
            unpricedQty: 1320000,
            uom: 'bu',
            marketMonth: 'Nov-24',
            pricingPoint: 'Fargo Elevator',
            marketZone: 'Prairie North',
            basis: 0.22,
            futuresPrice: 13.11,
            contractLocalPrice: 13.4,
            deliveryWindow: 'Aug 22 - Aug 30',
            status: 'Working',
            freightAccrual: { reserved: 33800, actual: null, zoneVariance: -1800 },
          },
          {
            id: 'SC-2202',
            counterparty: 'Viterra',
            type: 'Sale',
            commodity: 'Wheat',
            qty: 1620000,
            unpricedQty: 1080000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Pacific Export',
            marketZone: 'Pacific Northwest',
            basis: 0.29,
            futuresPrice: 7.38,
            contractLocalPrice: 7.89,
            deliveryWindow: 'Sep 03 - Sep 14',
            status: 'Confirmed',
            freightAccrual: { reserved: 40200, actual: 41450, zoneVariance: -900 },
          },
          {
            id: 'SC-2203',
            counterparty: 'Cargill',
            type: 'Purchase',
            commodity: 'Corn',
            qty: 2100000,
            unpricedQty: 1620000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Memphis Barge',
            marketZone: 'Mississippi River',
            basis: 0.15,
            futuresPrice: 5.02,
            contractLocalPrice: 5.34,
            deliveryWindow: 'Aug 12 - Aug 25',
            status: 'Open',
            freightAccrual: { reserved: 26800, actual: null, zoneVariance: 0 },
          },
          {
            id: 'SC-2204',
            counterparty: 'COFCO',
            type: 'Sale',
            commodity: 'Canola',
            qty: 124000,
            unpricedQty: 92000,
            uom: 'mt',
            marketMonth: 'Jan-25',
            pricingPoint: 'Winnipeg Crush',
            marketZone: 'Prairie North',
            basis: 23,
            futuresPrice: 684,
            contractLocalPrice: 695,
            deliveryWindow: 'Oct 22 - Nov 04',
            status: 'Working',
            freightAccrual: { reserved: 47200, actual: 48950, zoneVariance: -1600 },
          },
          {
            id: 'SC-2205',
            counterparty: 'The Andersons',
            type: 'Purchase',
            commodity: 'Corn',
            qty: 1640000,
            unpricedQty: 820000,
            uom: 'bu',
            marketMonth: 'Mar-25',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
            basis: 0.19,
            futuresPrice: 5.18,
            contractLocalPrice: 5.71,
            deliveryWindow: 'Sep 10 - Sep 18',
            status: 'Open',
            freightAccrual: { reserved: 24700, actual: null, zoneVariance: -1100 },
          },
          {
            id: 'SC-2206',
            counterparty: 'Bunge',
            type: 'Sale',
            commodity: 'Soybeans',
            qty: 1680000,
            unpricedQty: 720000,
            uom: 'bu',
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Shuttle',
            marketZone: 'Prairie North',
            basis: 0.25,
            futuresPrice: 13.07,
            contractLocalPrice: 13.42,
            deliveryWindow: 'Sep 28 - Oct 09',
            status: 'Nominated',
            freightAccrual: { reserved: 32200, actual: null, zoneVariance: -2100 },
          },
          {
            id: 'SC-2207',
            counterparty: 'CHS',
            type: 'Purchase',
            commodity: 'Wheat',
            qty: 1420000,
            unpricedQty: 880000,
            uom: 'bu',
            marketMonth: 'Dec-24',
            pricingPoint: 'Northern Rail',
            marketZone: 'Northern Plains',
            basis: 0.23,
            futuresPrice: 7.36,
            contractLocalPrice: 7.69,
            deliveryWindow: 'Aug 05 - Aug 16',
            status: 'Open',
            freightAccrual: { reserved: 30100, actual: null, zoneVariance: -850 },
          },
          {
            id: 'SC-2208',
            counterparty: 'Marubeni',
            type: 'Sale',
            commodity: 'Corn',
            qty: 1840000,
            unpricedQty: 740000,
            uom: 'bu',
            marketMonth: 'Mar-25',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
            basis: 0.22,
            futuresPrice: 5.22,
            contractLocalPrice: 5.76,
            deliveryWindow: 'Nov 12 - Nov 28',
            status: 'Confirmed',
            freightAccrual: { reserved: 39200, actual: 38100, zoneVariance: -900 },
          },
          {
            id: 'SC-2209',
            counterparty: 'Richardson',
            type: 'Purchase',
            commodity: 'Canola',
            qty: 110000,
            unpricedQty: 76000,
            uom: 'mt',
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Terminal',
            marketZone: 'Prairie South',
            basis: 19,
            futuresPrice: 678,
            contractLocalPrice: 688,
            deliveryWindow: 'Aug 18 - Aug 30',
            status: 'Working',
            freightAccrual: { reserved: 36800, actual: null, zoneVariance: -1300 },
          },
          {
            id: 'SC-2210',
            counterparty: 'Tyson Foods',
            type: 'Sale',
            commodity: 'Soybeans',
            qty: 1480000,
            unpricedQty: 520000,
            uom: 'bu',
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Shuttle',
            marketZone: 'Prairie North',
            basis: 0.27,
            futuresPrice: 13.1,
            contractLocalPrice: 13.46,
            deliveryWindow: 'Oct 18 - Oct 28',
            status: 'Nominated',
            freightAccrual: { reserved: 28800, actual: null, zoneVariance: -2200 },
          },
        ],
        inventoryLots: [
          {
            id: 'LOT-3001',
            commodity: 'Soybeans',
            qty: 760000,
            uom: 'bu',
            elevator: 'Fargo Elevator',
            grade: 'No.1',
            moisture: 11.4,
            protein: 35.2,
            startDate: '2024-06-28',
            carryingPrice: 13.05,
            marketMonth: 'Nov-24',
            pricingPoint: 'Fargo Elevator',
            marketZone: 'Prairie North',
          },
          {
            id: 'LOT-3002',
            commodity: 'Corn',
            qty: 940000,
            uom: 'bu',
            elevator: 'Memphis Barge',
            grade: 'No.2 Yellow',
            moisture: 14.3,
            protein: 8.5,
            startDate: '2024-05-22',
            carryingPrice: 4.96,
            marketMonth: 'Dec-24',
            pricingPoint: 'Memphis Barge',
            marketZone: 'Mississippi River',
          },
          {
            id: 'LOT-3003',
            commodity: 'Wheat',
            qty: 580000,
            uom: 'bu',
            elevator: 'Pacific Export',
            grade: 'HRW 12% Protein',
            moisture: 12.5,
            protein: 12.5,
            startDate: '2024-06-30',
            carryingPrice: 7.18,
            marketMonth: 'Dec-24',
            pricingPoint: 'Pacific Export',
            marketZone: 'Pacific Northwest',
          },
          {
            id: 'LOT-3004',
            commodity: 'Canola',
            qty: 47000,
            uom: 'mt',
            elevator: 'Winnipeg Crush',
            grade: 'Canola 1 Canada',
            moisture: 9.4,
            protein: 21.8,
            startDate: '2024-04-26',
            carryingPrice: 676,
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Terminal',
            marketZone: 'Prairie South',
          },
          {
            id: 'LOT-3005',
            commodity: 'Soybeans',
            qty: 480000,
            uom: 'bu',
            elevator: 'Prairie Shuttle',
            grade: 'No.1',
            moisture: 10.7,
            protein: 34.6,
            startDate: '2024-07-12',
            carryingPrice: 13.12,
            marketMonth: 'Nov-24',
            pricingPoint: 'Prairie Shuttle',
            marketZone: 'Prairie North',
          },
          {
            id: 'LOT-3006',
            commodity: 'Corn',
            qty: 410000,
            uom: 'bu',
            elevator: 'Gulf Elevation',
            grade: 'No.2 Yellow',
            moisture: 13.6,
            protein: 9.0,
            startDate: '2024-07-20',
            carryingPrice: 5.07,
            marketMonth: 'Mar-25',
            pricingPoint: 'Gulf Elevation',
            marketZone: 'Gulf Export',
          },
        ],
        futuresPositions: [
          { id: 'FUT-201', symbol: 'ZS', commodity: 'Soybeans', month: 'Nov-24', qty: -150, avgPrice: 13.05 },
          { id: 'FUT-202', symbol: 'ZC', commodity: 'Corn', month: 'Dec-24', qty: -120, avgPrice: 4.98 },
          { id: 'FUT-203', symbol: 'ZW', commodity: 'Wheat', month: 'Dec-24', qty: -70, avgPrice: 7.19 },
          { id: 'FUT-204', symbol: 'RS', commodity: 'Canola', month: 'Jan-25', qty: -90, avgPrice: 682 },
        ],
        pricing: {
          marketPrices: {
            Soybeans: { 'Nov-24': 13.28, 'Jan-25': 12.97 },
            Corn: { 'Dec-24': 5.09, 'Mar-25': 5.24 },
            Wheat: { 'Dec-24': 7.39, 'Mar-25': 7.51 },
            Canola: { 'Nov-24': 689, 'Jan-25': 694 },
          },
          pricingPoints: {
            'Fargo Elevator': { Soybeans: 0.22 },
            'Memphis Barge': { Corn: 0.12 },
            'Gulf Elevation': { Corn: 0.2, Wheat: 0.29 },
            'Winnipeg Crush': { Canola: 5.1 },
            'Prairie Shuttle': { Soybeans: 0.25 },
            'Prairie Terminal': { Canola: 3.8 },
            'Pacific Export': { Wheat: 0.33 },
            'Northern Rail': { Wheat: 0.17 },
          },
          zoneSpreads: {
            'Prairie North': { Soybeans: -0.05, Canola: -4.1 },
            'Prairie South': { Canola: -2.9 },
            'Gulf Export': { Corn: 0.21, Wheat: 0.31 },
            'Mississippi River': { Corn: 0.18 },
            'Pacific Northwest': { Wheat: 0.3, Canola: -2.6 },
            'Northern Plains': { Wheat: 0.15 },
          },
        },
        adjustments: {
          other: 510000,
          workingCapitalBase: 81200000,
          futuresRealized: 0,
        },
        openTickets: [
          { id: 'TK-SC-2201A', tradeId: 'SC-2201', commodity: 'Soybeans', qty: 160000, uom: 'bu', elevator: 'Fargo Elevator', marketZone: 'Prairie North', status: 'Open' },
          { id: 'TK-SC-2203B', tradeId: 'SC-2203', commodity: 'Corn', qty: 200000, uom: 'bu', elevator: 'Memphis Barge', marketZone: 'Mississippi River', status: 'Open' },
          { id: 'TK-SC-2204A', tradeId: 'SC-2204', commodity: 'Canola', qty: 16000, uom: 'mt', elevator: 'Winnipeg Crush', marketZone: 'Prairie North', status: 'Open' },
          { id: 'TK-SC-2208C', tradeId: 'SC-2208', commodity: 'Corn', qty: 220000, uom: 'bu', elevator: 'Gulf Elevation', marketZone: 'Gulf Export', status: 'Open' },
        ],
        referenceData: {
          Commodities: ['Soybeans', 'Corn', 'Wheat', 'Canola'],
          'Trade Units': ['bu', 'mt'],
          Elevators: ['Fargo Elevator', 'Memphis Barge', 'Gulf Elevation', 'Prairie Shuttle', 'Winnipeg Crush'],
          'Market Zones': ['Prairie North', 'Prairie South', 'Gulf Export', 'Mississippi River', 'Pacific Northwest'],
        },
      },
    },
  };

  const listeners = new Set();
  const engine = valuationFactory.create();
  let state = null;
  let driftCursor = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emit(type, payload) {
    const event = { type, payload, timestamp: state?.lastEvent || Date.now() };
    listeners.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('CTRMData subscriber error', error);
      }
    });
  }

  function nextDrift() {
    driftCursor += 1;
    const raw = Math.sin(driftCursor * 12.9898) * 43758.5453;
    const normalized = raw - Math.floor(raw);
    return (normalized - 0.5) * 0.003; // ±0.15%
  }

  function applyBoardDrift(commodity, month) {
    if (!state?.pricing?.marketPrices?.[commodity]?.[month]) return;
    const current = state.pricing.marketPrices[commodity][month];
    const drift = nextDrift();
    state.pricing.marketPrices[commodity][month] = Number((current * (1 + drift)).toFixed(4));
  }

  function initialiseSnapshot(key) {
    const template = SNAPSHOT_TEMPLATES[key];
    if (!template) {
      throw new Error(`Unknown snapshot ${key}`);
    }

    const dataset = clone(template.dataset);

    state = {
      snapshotKey: key,
      label: template.label,
      bulletins: template.bulletins.slice(),
      trades: dataset.trades.map((trade) => ({
        ...trade,
        unpricedQty: trade.unpricedQty ?? trade.qty,
      })),
      inventoryLots: dataset.inventoryLots.map((lot) => ({ ...lot })),
      futuresPositions: dataset.futuresPositions.map((position) => ({ ...position })),
      pricing: dataset.pricing,
      seedPricing: clone(dataset.pricing),
      adjustments: { ...dataset.adjustments },
      openTickets: (dataset.openTickets || []).map((ticket) => ({ ...ticket })),
      referenceData: dataset.referenceData || {},
      lastEvent: Date.now(),
    };

    engine.evaluate(state);
    state.lastResult = engine.lastResult;
    state.lastEvent = Date.now();
    emit('ctrm:snapshotChanged', { snapshot: getSnapshot(), aggregates: engine.computeAggregates(), timestamp: state.lastEvent });
  }

  function recompute(reason, payload = {}, eventType = 'ctrm:dataChanged') {
    engine.evaluate(state);
    state.lastResult = engine.lastResult;
    state.lastEvent = Date.now();
    emit(eventType, {
      reason,
      ...payload,
      snapshot: getSnapshot(),
      aggregates: engine.computeAggregates(),
      timestamp: state.lastEvent,
    });
  }

  function subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  function getSnapshot() {
    return {
      key: state.snapshotKey,
      label: state.label,
      bulletins: state.bulletins.slice(),
    };
  }

  function getAggregates() {
    return engine.computeAggregates();
  }

  function getTrades() {
    return state.trades.map((trade) => ({
      ...trade,
      currentLocalPrice: trade.currentLocalPrice,
      flatPrice: trade.flatPrice,
    }));
  }

  function getTradeById(id) {
    return getTrades().find((trade) => trade.id === id);
  }

  function getExposureSummary() {
    const exposures = engine.getExposureByCommodity();
    const byCommodity = {};
    Object.entries(exposures).forEach(([commodity, bucket]) => {
      byCommodity[commodity] = {
        physical: Math.abs(bucket.physical),
        hedged: Math.min(Math.abs(bucket.hedged), Math.abs(bucket.physical)),
      };
    });
    return { byCommodity };
  }

  function getHedgeSeries() {
    return engine.getHedgeSeries();
  }

  function getMtmSeries() {
    return engine.getMtmSeries();
  }

  function getInventory() {
    const breakdown = engine.getInventoryBreakdown();
    const grouped = state.inventoryLots.reduce((acc, lot) => {
      acc[lot.elevator] = acc[lot.elevator] || [];
      acc[lot.elevator].push({
        id: lot.id,
        commodity: lot.commodity,
        qty: lot.qty,
        uom: lot.uom,
        grade: lot.grade,
        moisture: lot.moisture,
        protein: lot.protein,
        age: utils.daysBetween(lot.startDate),
      });
      return acc;
    }, {});

    const lotsByElevator = Object.entries(grouped).map(([elevator, lots]) => ({ elevator, lots }));
    const openTickets = state.openTickets.filter((ticket) => ticket.status === 'Open');

    return {
      lotsByElevator,
      monthExposure: breakdown.byMonth,
      qualityDistribution: breakdown.byQuality,
      agingCurve: breakdown.byAging,
      openTickets,
    };
  }

  function buildSuggestedMonths() {
    const suggestions = [];
    Object.entries(state.pricing.marketPrices || {}).forEach(([commodity, months]) => {
      Object.entries(months).forEach(([month, board]) => {
        suggestions.push({ commodity, month, board });
      });
    });
    return suggestions.sort((a, b) => a.month.localeCompare(b.month));
  }

  function getFutures() {
    const positions = state.futuresPositions.map((position) => ({ ...position }));
    const hedgeSeries = engine.getHedgeSeries();
    const hedgeMonths = hedgeSeries.map((point) => new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const hedgeRatioHistory = hedgeSeries.map((point) => Number(point.value.toFixed(2)));
    const aggregates = getAggregates();
    const pnlSensitivity = [-3, -2, -1, 0, 1, 2, 3].map((step) => Number((aggregates.futuresPL + step * 0.2).toFixed(2)));

    return {
      positions,
      suggestedMonths: buildSuggestedMonths(),
      hedgeMonths,
      hedgeRatioHistory,
      pnlSensitivity,
    };
  }

  function flattenPricingMatrix(matrix) {
    const rows = [];
    Object.entries(matrix || {}).forEach(([outerKey, inner]) => {
      Object.entries(inner || {}).forEach(([innerKey, value]) => {
        rows.push({
          key: outerKey,
          innerKey,
          value,
        });
      });
    });
    return rows;
  }

  function getPricing() {
    return {
      marketPrices: flattenPricingMatrix(state.pricing.marketPrices).map(({ key, innerKey, value }) => ({
        commodity: key,
        month: innerKey,
        price: value,
      })),
      pricingPoints: flattenPricingMatrix(state.pricing.pricingPoints).map(({ key, innerKey, value }) => ({
        name: key,
        commodity: innerKey,
        adjustment: value,
      })),
      zoneSpreads: flattenPricingMatrix(state.pricing.zoneSpreads).map(({ key, innerKey, value }) => ({
        zone: key,
        commodity: innerKey,
        spread: value,
      })),
    };
  }

  function getReferenceData() {
    return { ...state.referenceData };
  }

  function getDebugState() {
    return {
      snapshot: state.snapshotKey,
      aggregates: getAggregates(),
      charts: window.CTRMCharts ? window.CTRMCharts.count() : 0,
      lastEvent: state.lastEvent,
    };
  }

  function getVarianceActivity() {
    const aggregates = getAggregates();
    return [
      { label: 'New', count: state.snapshotKey === 'today' ? 6 : 4, delta: Number((aggregates.basisPL * 0.32).toFixed(2)) },
      { label: 'Changed', count: state.snapshotKey === 'today' ? 5 : 7, delta: Number((aggregates.futuresPL * 0.28).toFixed(2)) },
      { label: 'Closed', count: 3, delta: Number((aggregates.freightVar * 0.45).toFixed(2)) },
      { label: 'Reopened', count: 2, delta: Number((aggregates.otherPL * 0.18).toFixed(2)) },
    ];
  }

  function getCarrySpark() {
    const buckets = engine.getInventoryBreakdown().byAging;
    if (!buckets.length) return [0];
    return buckets.map((bucket, index) => Number(((bucket.value / 1_000_000) + index * 0.05).toFixed(2)));
  }

  function getCarryHeadline() {
    const aggregates = getAggregates();
    const daily = (aggregates.workingCapital * 1_000_000 * 0.015) / 365;
    return `Daily carry interest ${ (daily / 1_000_000).toFixed(2) }MM across elevators`;
  }

  function getIntel() {
    const snapshot = getSnapshot();
    const headlines = snapshot.bulletins.map((headline, index) => ({
      headline,
      takeaway: index % 2 === 0 ? 'Monitor deferred spreads for follow-through on today’s move.' : 'Desk focus: confirm counterparties align with updated pricing stack.',
    }));
    const aggregates = getAggregates();
    const tiles = [
      { label: '30d Vol vs Current', value: `${(45 + aggregates.hedgeCoverage / 3).toFixed(1)}%`, context: 'Desk VAR within guardrails' },
      { label: 'Seasonality', value: `${(aggregates.basisPL + 5).toFixed(2)} MM`, context: 'vs 5yr average' },
      { label: 'Front Spreads', value: `${(aggregates.futuresPL + aggregates.freightVar).toFixed(2)} MM`, context: 'Carry vs prompt' },
    ];
    return { headlines, tiles };
  }

  function setSnapshot(key) {
    initialiseSnapshot(key);
  }

  function setSnapshotToCurrent() {
    initialiseSnapshot(state.snapshotKey);
  }

  function updateMarketPrice({ commodity, month, value }) {
    if (!commodity || !month) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    state.pricing.marketPrices[commodity] = state.pricing.marketPrices[commodity] || {};
    state.pricing.marketPrices[commodity][month] = numeric;
    applyBoardDrift(commodity, month);
    recompute('pricing-market', { commodity, month });
  }

  function updatePricingPoint({ name, commodity, value }) {
    if (!name || !commodity) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    state.pricing.pricingPoints[name] = state.pricing.pricingPoints[name] || {};
    state.pricing.pricingPoints[name][commodity] = numeric;
    applyBoardDrift(commodity, Object.keys(state.pricing.marketPrices[commodity] || {})[0] || '');
    recompute('pricing-point', { name, commodity });
  }

  function updateZoneSpread({ zone, commodity, value }) {
    if (!zone || !commodity) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    state.pricing.zoneSpreads[zone] = state.pricing.zoneSpreads[zone] || {};
    state.pricing.zoneSpreads[zone][commodity] = numeric;
    applyBoardDrift(commodity, Object.keys(state.pricing.marketPrices[commodity] || {})[0] || '');
    recompute('pricing-zone', { zone, commodity });
  }

  function revertPricing() {
    state.pricing = clone(state.seedPricing);
    recompute('pricing-revert', { toast: 'Pricing reset to snapshot defaults.' });
  }

  function hedgeExposure({ commodity, percent, month }) {
    if (!commodity || !Number.isFinite(percent)) return;
    const exposures = engine.getExposureByCommodity();
    const bucket = exposures[commodity];
    if (!bucket) return;

    const physical = bucket.physical;
    const targetRatio = Math.max(0, Math.min(100, percent)) / 100;
    const targetQty = Math.abs(physical) * targetRatio;
    const multiplier = CONTRACT_MULTIPLIERS[commodity] || 1;
    const contracts = multiplier === 0 ? 0 : Math.round(targetQty / multiplier);
    const sign = physical >= 0 ? -1 : 1;
    const desiredContracts = contracts * sign;

    const symbol = COMMODITY_SYMBOL[commodity];
    if (!symbol) return;
    let position = state.futuresPositions.find((pos) => pos.symbol === symbol && pos.month === month);
    const board = state.pricing.marketPrices?.[commodity]?.[month];
    if (!position) {
      position = { id: `FUT-${Date.now()}`, symbol, commodity, month, qty: 0, avgPrice: board || 0 };
      state.futuresPositions.push(position);
    }

    if (board && position.qty !== desiredContracts) {
      const existingContracts = position.qty;
      const deltaContracts = desiredContracts - existingContracts;
      if (existingContracts === 0) {
        position.avgPrice = board;
      } else if (deltaContracts !== 0) {
        position.avgPrice = ((position.avgPrice * existingContracts) + (board * deltaContracts)) / (existingContracts + deltaContracts);
      }
    }

    position.qty = desiredContracts;
    applyBoardDrift(commodity, month);
    recompute('hedge', { commodity, percent, month });
  }

  function rollMonth({ symbol, from, to }) {
    if (!symbol || !from || !to) return;
    const position = state.futuresPositions.find((pos) => pos.symbol === symbol && pos.month === from);
    if (!position) return;

    const commodity = position.commodity || Object.keys(COMMODITY_SYMBOL).find((key) => COMMODITY_SYMBOL[key] === symbol);
    const multiplier = CONTRACT_MULTIPLIERS[commodity] || 1;
    const boardFrom = state.pricing.marketPrices?.[commodity]?.[from];
    const boardTo = state.pricing.marketPrices?.[commodity]?.[to];
    if (!boardFrom || !boardTo) return;

    const realized = (boardFrom - position.avgPrice) * position.qty * multiplier;
    state.adjustments.futuresRealized = (state.adjustments.futuresRealized || 0) + realized;

    position.month = to;
    position.avgPrice = boardTo;

    applyBoardDrift(commodity, to);
    recompute('roll', { toast: `${symbol} ${from}→${to} roll delta ${realized >= 0 ? '+' : ''}${(realized / 1_000_000).toFixed(2)}MM` });
  }

  function matchTicket(id) {
    const ticket = state.openTickets.find((entry) => entry.id === id);
    if (!ticket || ticket.status !== 'Open') return;
    ticket.status = 'Matched';

    const trade = state.trades.find((t) => t.id === ticket.tradeId);
    if (trade) {
      trade.unpricedQty = Math.max(0, (trade.unpricedQty || trade.qty) - ticket.qty);
      if (trade.unpricedQty <= trade.qty * 0.05) {
        trade.unpricedQty = 0;
        trade.status = 'Closed';
      } else if (trade.status === 'Open') {
        trade.status = 'Working';
      }
    }

    const lot = state.inventoryLots.find((entry) => entry.elevator === ticket.elevator && entry.commodity === ticket.commodity);
    if (lot) {
      lot.qty = Math.max(0, lot.qty - ticket.qty);
    }

    const commodity = ticket.commodity;
    const month = trade?.marketMonth || Object.keys(state.pricing.marketPrices[commodity] || {})[0];
    applyBoardDrift(commodity, month);
    recompute('match', { toast: `Matched ticket ${ticket.id}` });
  }

  function resetDemo() {
    setSnapshotToCurrent();
  }

  function forceRecompute() {
    recompute('manual');
  }

  initialiseSnapshot('today');

  window.CTRMData = {
    subscribe,
    setSnapshot,
    getSnapshot,
    getAggregates,
    getTrades,
    getTradeById,
    getExposureSummary,
    getHedgeSeries,
    getMtmSeries,
    getInventory,
    getFutures,
    getPricing,
    getReferenceData,
    getDebugState,
    getVarianceActivity,
    getCarrySpark,
    getCarryHeadline,
    getIntel,
    updateMarketPrice,
    updatePricingPoint,
    updateZoneSpread,
    revertPricing,
    hedgeExposure,
    rollMonth,
    matchTicket,
    resetDemo,
    forceRecompute,
  };
})();
