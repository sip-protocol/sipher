# BackendsCompare200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Operation** | Pointer to **string** |  | [optional] 
**Chain** | Pointer to **string** |  | [optional] 
**Comparisons** | Pointer to [**[]BackendsCompare200ResponseDataComparisonsInner**](BackendsCompare200ResponseDataComparisonsInner.md) |  | [optional] 
**Recommendation** | Pointer to [**BackendsCompare200ResponseDataRecommendation**](BackendsCompare200ResponseDataRecommendation.md) |  | [optional] 

## Methods

### NewBackendsCompare200ResponseData

`func NewBackendsCompare200ResponseData() *BackendsCompare200ResponseData`

NewBackendsCompare200ResponseData instantiates a new BackendsCompare200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBackendsCompare200ResponseDataWithDefaults

`func NewBackendsCompare200ResponseDataWithDefaults() *BackendsCompare200ResponseData`

NewBackendsCompare200ResponseDataWithDefaults instantiates a new BackendsCompare200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetOperation

`func (o *BackendsCompare200ResponseData) GetOperation() string`

GetOperation returns the Operation field if non-nil, zero value otherwise.

### GetOperationOk

`func (o *BackendsCompare200ResponseData) GetOperationOk() (*string, bool)`

GetOperationOk returns a tuple with the Operation field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOperation

`func (o *BackendsCompare200ResponseData) SetOperation(v string)`

SetOperation sets Operation field to given value.

### HasOperation

`func (o *BackendsCompare200ResponseData) HasOperation() bool`

HasOperation returns a boolean if a field has been set.

### GetChain

`func (o *BackendsCompare200ResponseData) GetChain() string`

GetChain returns the Chain field if non-nil, zero value otherwise.

### GetChainOk

`func (o *BackendsCompare200ResponseData) GetChainOk() (*string, bool)`

GetChainOk returns a tuple with the Chain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChain

`func (o *BackendsCompare200ResponseData) SetChain(v string)`

SetChain sets Chain field to given value.

### HasChain

`func (o *BackendsCompare200ResponseData) HasChain() bool`

HasChain returns a boolean if a field has been set.

### GetComparisons

`func (o *BackendsCompare200ResponseData) GetComparisons() []BackendsCompare200ResponseDataComparisonsInner`

GetComparisons returns the Comparisons field if non-nil, zero value otherwise.

### GetComparisonsOk

`func (o *BackendsCompare200ResponseData) GetComparisonsOk() (*[]BackendsCompare200ResponseDataComparisonsInner, bool)`

GetComparisonsOk returns a tuple with the Comparisons field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetComparisons

`func (o *BackendsCompare200ResponseData) SetComparisons(v []BackendsCompare200ResponseDataComparisonsInner)`

SetComparisons sets Comparisons field to given value.

### HasComparisons

`func (o *BackendsCompare200ResponseData) HasComparisons() bool`

HasComparisons returns a boolean if a field has been set.

### GetRecommendation

`func (o *BackendsCompare200ResponseData) GetRecommendation() BackendsCompare200ResponseDataRecommendation`

GetRecommendation returns the Recommendation field if non-nil, zero value otherwise.

### GetRecommendationOk

`func (o *BackendsCompare200ResponseData) GetRecommendationOk() (*BackendsCompare200ResponseDataRecommendation, bool)`

GetRecommendationOk returns a tuple with the Recommendation field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecommendation

`func (o *BackendsCompare200ResponseData) SetRecommendation(v BackendsCompare200ResponseDataRecommendation)`

SetRecommendation sets Recommendation field to given value.

### HasRecommendation

`func (o *BackendsCompare200ResponseData) HasRecommendation() bool`

HasRecommendation returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


