# BackendsHealth200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | Pointer to **string** |  | [optional] 
**Available** | Pointer to **bool** |  | [optional] 
**EstimatedCost** | Pointer to **string** | BigInt as string | [optional] 
**EstimatedTime** | Pointer to **int32** | Estimated time in ms | [optional] 
**Health** | Pointer to [**BackendsHealth200ResponseDataHealth**](BackendsHealth200ResponseDataHealth.md) |  | [optional] 
**Metrics** | Pointer to [**BackendsHealth200ResponseDataMetrics**](BackendsHealth200ResponseDataMetrics.md) |  | [optional] 
**Capabilities** | Pointer to **map[string]interface{}** |  | [optional] 

## Methods

### NewBackendsHealth200ResponseData

`func NewBackendsHealth200ResponseData() *BackendsHealth200ResponseData`

NewBackendsHealth200ResponseData instantiates a new BackendsHealth200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBackendsHealth200ResponseDataWithDefaults

`func NewBackendsHealth200ResponseDataWithDefaults() *BackendsHealth200ResponseData`

NewBackendsHealth200ResponseDataWithDefaults instantiates a new BackendsHealth200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *BackendsHealth200ResponseData) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *BackendsHealth200ResponseData) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *BackendsHealth200ResponseData) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *BackendsHealth200ResponseData) HasName() bool`

HasName returns a boolean if a field has been set.

### GetAvailable

`func (o *BackendsHealth200ResponseData) GetAvailable() bool`

GetAvailable returns the Available field if non-nil, zero value otherwise.

### GetAvailableOk

`func (o *BackendsHealth200ResponseData) GetAvailableOk() (*bool, bool)`

GetAvailableOk returns a tuple with the Available field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAvailable

`func (o *BackendsHealth200ResponseData) SetAvailable(v bool)`

SetAvailable sets Available field to given value.

### HasAvailable

`func (o *BackendsHealth200ResponseData) HasAvailable() bool`

HasAvailable returns a boolean if a field has been set.

### GetEstimatedCost

`func (o *BackendsHealth200ResponseData) GetEstimatedCost() string`

GetEstimatedCost returns the EstimatedCost field if non-nil, zero value otherwise.

### GetEstimatedCostOk

`func (o *BackendsHealth200ResponseData) GetEstimatedCostOk() (*string, bool)`

GetEstimatedCostOk returns a tuple with the EstimatedCost field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEstimatedCost

`func (o *BackendsHealth200ResponseData) SetEstimatedCost(v string)`

SetEstimatedCost sets EstimatedCost field to given value.

### HasEstimatedCost

`func (o *BackendsHealth200ResponseData) HasEstimatedCost() bool`

HasEstimatedCost returns a boolean if a field has been set.

### GetEstimatedTime

`func (o *BackendsHealth200ResponseData) GetEstimatedTime() int32`

GetEstimatedTime returns the EstimatedTime field if non-nil, zero value otherwise.

### GetEstimatedTimeOk

`func (o *BackendsHealth200ResponseData) GetEstimatedTimeOk() (*int32, bool)`

GetEstimatedTimeOk returns a tuple with the EstimatedTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEstimatedTime

`func (o *BackendsHealth200ResponseData) SetEstimatedTime(v int32)`

SetEstimatedTime sets EstimatedTime field to given value.

### HasEstimatedTime

`func (o *BackendsHealth200ResponseData) HasEstimatedTime() bool`

HasEstimatedTime returns a boolean if a field has been set.

### GetHealth

`func (o *BackendsHealth200ResponseData) GetHealth() BackendsHealth200ResponseDataHealth`

GetHealth returns the Health field if non-nil, zero value otherwise.

### GetHealthOk

`func (o *BackendsHealth200ResponseData) GetHealthOk() (*BackendsHealth200ResponseDataHealth, bool)`

GetHealthOk returns a tuple with the Health field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetHealth

`func (o *BackendsHealth200ResponseData) SetHealth(v BackendsHealth200ResponseDataHealth)`

SetHealth sets Health field to given value.

### HasHealth

`func (o *BackendsHealth200ResponseData) HasHealth() bool`

HasHealth returns a boolean if a field has been set.

### GetMetrics

`func (o *BackendsHealth200ResponseData) GetMetrics() BackendsHealth200ResponseDataMetrics`

GetMetrics returns the Metrics field if non-nil, zero value otherwise.

### GetMetricsOk

`func (o *BackendsHealth200ResponseData) GetMetricsOk() (*BackendsHealth200ResponseDataMetrics, bool)`

GetMetricsOk returns a tuple with the Metrics field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMetrics

`func (o *BackendsHealth200ResponseData) SetMetrics(v BackendsHealth200ResponseDataMetrics)`

SetMetrics sets Metrics field to given value.

### HasMetrics

`func (o *BackendsHealth200ResponseData) HasMetrics() bool`

HasMetrics returns a boolean if a field has been set.

### GetCapabilities

`func (o *BackendsHealth200ResponseData) GetCapabilities() map[string]interface{}`

GetCapabilities returns the Capabilities field if non-nil, zero value otherwise.

### GetCapabilitiesOk

`func (o *BackendsHealth200ResponseData) GetCapabilitiesOk() (*map[string]interface{}, bool)`

GetCapabilitiesOk returns a tuple with the Capabilities field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCapabilities

`func (o *BackendsHealth200ResponseData) SetCapabilities(v map[string]interface{})`

SetCapabilities sets Capabilities field to given value.

### HasCapabilities

`func (o *BackendsHealth200ResponseData) HasCapabilities() bool`

HasCapabilities returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


